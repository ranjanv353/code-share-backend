import express from "express";
import ddbDocClient from "../db/dynamo.js";
import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createGuestRoom, getGuestRoom, updateGuestRoom } from "../db/guestRooms.js";
import { generateRoomId, generateRoomName } from "../db/roomUtils.js";

const router = express.Router();

function removeUndefined(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, removeUndefined(v)])
  );
}

function getUserType(req) {
  return req.headers["x-user-type"];
}
function getUserId(req) {
  return req.headers["x-user-id"];
}
function getUserEmail(req) {
  return req.headers["x-user-email"];
}

async function tryGetGuestRoom(id) {
  const guestRoom = await getGuestRoom(id);
  return guestRoom || null;
}

async function tryGetDynamoRoom(id) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: process.env.ROOMS_TABLE,
      Key: { id },
    })
  );
  return result.Item || null;
}

// POST /rooms (create)
router.post("/", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  try {
    if (userType === "guest" || !userId) {
      // Guests can only create public rooms
      const guestRoom = await createGuestRoom({ ...req.body, type: "public" });
      return res.status(201).json(guestRoom);
    } else {
      // Authenticated user, DynamoDB
      const id = generateRoomId();
      const name = generateRoomName();
      const language = req.body.language || "javascript";
      const createdAt = new Date().toISOString();
      const owner = userId;
      const type = req.body.type === "private" ? "private" : "public";
      const members = [{ userId: owner, email: userEmail, role: "owner" }];

      const item = removeUndefined({
        ...req.body,
        id,
        name,
        language,
        content: req.body.content || "",
        createdAt,
        owner,
        type,
        members,
      });

      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.ROOMS_TABLE,
          Item: item,
        })
      );
      return res.status(201).json(item);
    }
  } catch (err) {
    next(err);
  }
});

// GET /rooms/:id (unified logic!)
router.get("/:id", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);
  const id = req.params.id;

  try {
    // 1. Try guest room store (ephemeral)
    const guestRoom = await tryGetGuestRoom(id);
    if (guestRoom) {
      if (guestRoom.type === "public") {
        return res.json(guestRoom);
      }
      if (userType === "guest" || !userId) {
        return res.json(guestRoom);
      }
      return res.status(403).json({ error: "You do not have access to this room." });
    }

    // 2. Try DynamoDB (persistent)
    const room = await tryGetDynamoRoom(id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (room.type === "public") {
      return res.json(room);
    }

    const isMember = room.members?.some(
      m =>
        (m.userId && userId && m.userId === userId) ||
        (m.email && userEmail && m.email === userEmail)
    );
    if (isMember) return res.json(room);

    return res.status(403).json({ error: "You do not have permission to access this room." });
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id (update)
router.patch("/:id", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);
  const id = req.params.id;

  try {
    // 1. Try guest room
    const guestRoom = await tryGetGuestRoom(id);
    if (guestRoom) {
      const allowedFields = ["name", "language", "type", "content"];
      const updates = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided." });
      }
      const updatedRoom = await updateGuestRoom(id, updates);
      return res.json(updatedRoom);
    }

    // 2. Try DynamoDB room
    const room = await tryGetDynamoRoom(id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Only allow owner/editor for private; anyone for public
    if (room.type !== "public") {
      const member = room.members?.find(
        m =>
          ((m.userId && userId && m.userId === userId) ||
            (m.email && userEmail && m.email === userEmail))
          && ["owner", "editor"].includes(m.role)
      );
      if (!member) {
        return res.status(403).json({ error: "You do not have permission to edit this room." });
      }
    }

    const allowedFields = ["name", "language", "type", "content"];
    const updateFields = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updateFields[key] = req.body[key];
    }
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided." });
    }

    const updateExpr = [];
    const exprAttrVals = {};
    const exprAttrNames = {};
    const reservedWords = ["name", "type", "language"];

    for (const [key, value] of Object.entries(updateFields)) {
      if (reservedWords.includes(key)) {
        updateExpr.push(`#${key} = :${key}`);
        exprAttrNames[`#${key}`] = key;
      } else {
        updateExpr.push(`${key} = :${key}`);
      }
      exprAttrVals[`:${key}`] = value;
    }

    const params = {
      TableName: process.env.ROOMS_TABLE,
      Key: { id },
      UpdateExpression: "SET " + updateExpr.join(", "),
      ExpressionAttributeValues: exprAttrVals,
      ExpressionAttributeNames: exprAttrNames,
      ReturnValues: "ALL_NEW",
    };
    const result = await ddbDocClient.send(new UpdateCommand(params));
    return res.json(result.Attributes);
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id/share (add/update/remove member) — DynamoDB only
router.patch("/:id/share", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);
  const id = req.params.id;

  // Sharing for guest rooms is not supported
  const guestRoom = await tryGetGuestRoom(id);
  if (guestRoom) {
    return res.status(403).json({ error: "Guest room sharing is not supported." });
  }

  // Must be authenticated
  if (userType !== "auth" || !userId) {
    return res.status(403).json({ error: "Only authenticated users can share persistent rooms." });
  }

  const { userId: memberUserId, email: memberEmail, role } = req.body;
  if ((!memberUserId && !memberEmail) || !role) {
    return res.status(400).json({ error: "userId or email and role are required" });
  }

  try {
    const room = await tryGetDynamoRoom(id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Only owner can share
    const isOwner = room.members?.some(
      m =>
        ((m.userId && userId && m.userId === userId) ||
          (m.email && userEmail && m.email === userEmail)) &&
        m.role === "owner"
    );
    if (!isOwner) {
      return res.status(403).json({ error: "Only owner can manage sharing." });
    }

    // Remove member if role === "remove"
    let members = Array.isArray(room.members) ? room.members : [];
    if (role === "remove") {
      members = members.filter(
        m =>
          !(
            (memberUserId && m.userId === memberUserId) ||
            (memberEmail && m.email === memberEmail)
          )
      );
    } else {
      // Update/add member (by id or email)
      let updated = false;
      members = members.map((member) => {
        if (
          (memberUserId && member.userId === memberUserId) ||
          (memberEmail && member.email === memberEmail)
        ) {
          updated = true;
          return removeUndefined({
            userId: memberUserId || member.userId,
            email: memberEmail || member.email,
            role,
          });
        }
        return member;
      });
      if (!updated) {
        members.push(removeUndefined({ userId: memberUserId, email: memberEmail, role }));
      }
    }

    members = removeUndefined(members);

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.ROOMS_TABLE,
        Key: { id },
        UpdateExpression: "SET members = :members",
        ExpressionAttributeValues: { ":members": members },
      })
    );
    res.status(200).json({ success: true, members });
  } catch (err) {
    next(err);
  }
});

// GET /rooms — List all rooms the authenticated user can access (dashboard)
router.get("/", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);

  if (userType !== "auth" || !userId) {
    return res.status(403).json({ error: "Only authenticated users can list rooms." });
  }

  try {
    const scanResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: process.env.ROOMS_TABLE,
      })
    );
    const items = scanResult.Items || [];
    const owned = [];
    const shared = [];
    items.forEach(room => {
      const members = room.members || [];
      const me = members.find(
        m =>
          (userId && m.userId === userId) ||
          (userEmail && m.email === userEmail)
      );
      if (!me) return;
      if (me.role === "owner") owned.push(room);
      else shared.push(room);
    });
    res.json({ owned, shared });
  } catch (err) {
    next(err);
  }
});

// DELETE /rooms/:id — Only owner can delete, auth only
router.delete("/:id", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);
  const userEmail = getUserEmail(req);
  const id = req.params.id;

  if (userType !== "auth" || !userId) {
    return res.status(403).json({ error: "Only authenticated users can delete rooms." });
  }

  try {
    const room = await tryGetDynamoRoom(id);
    if (!room) return res.status(404).json({ error: "Room not found" });

    const member = room.members?.find(
      m =>
        ((m.userId && userId && m.userId === userId) ||
          (m.email && userEmail && m.email === userEmail)) &&
        m.role === "owner"
    );
    if (!member) {
      return res.status(403).json({ error: "Only owner can delete this room." });
    }

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: process.env.ROOMS_TABLE,
        Key: { id },
      })
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
