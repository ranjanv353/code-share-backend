import express from "express";
import ddbDocClient from "../db/dynamo.js";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createGuestRoom, getGuestRoom, updateGuestRoom } from "../db/guestRooms.js";
import { generateRoomId, generateRoomName } from "../db/roomUtils.js";

const router = express.Router();

function getUserType(req) {
  return req.headers["x-user-type"];
}
function getUserId(req) {
  return req.headers["x-user-id"];
}

// POST /rooms (create)
router.post("/", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);

  try {
    if (userType === "guest" || !userId) {
      // Guest flow (Redis)
      const guestRoom = await createGuestRoom(req.body);
      return res.status(201).json(guestRoom);
    } else {
      // Authenticated flow (DynamoDB)
      const id = generateRoomId();
      const name = generateRoomName();
      const language = req.body.language || "javascript";
      const createdAt = new Date().toISOString();
      const owner = userId;
      const type = req.body.type || "public";
      const members = [{ userId: owner, role: "owner" }];

      const item = {
        ...req.body,
        id,
        name,
        language,
        content: req.body.content || "",
        createdAt,
        owner,
        type,
        members,
      };

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

// GET /rooms/:id (fetch)
router.get("/:id", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);

  try {
    if (userType === "guest" || !userId) {
      // Guest flow (Redis)
      const guestRoom = await getGuestRoom(req.params.id);
      if (!guestRoom)
        return res.status(404).json({ error: "Room not found or expired" });
      return res.json(guestRoom);
    } else {
      // Authenticated flow (DynamoDB)
      const result = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.ROOMS_TABLE,
          Key: { id: req.params.id },
        })
      );
      if (!result.Item) return res.status(404).json({ error: "Room not found" });
      res.json(result.Item);
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /rooms/:id (update)
// Authenticated rooms only for now
router.patch("/:id", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);

  try {
    if (userType === "guest" || !userId) {
      // Guest flow (Redis)
      const guestRoom = await getGuestRoom(req.params.id);
      if (!guestRoom) {
        return res.status(404).json({ error: "Guest room not found or expired" });
      }

      const allowedFields = ["name", "language", "type", "content"];
      const updates = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updatable fields provided." });
      }

      const updatedRoom = await updateGuestRoom(req.params.id, updates);
      return res.json(updatedRoom);
    }

    // Authenticated flow (DynamoDB)
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
      Key: { id: req.params.id },
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

// PATCH /rooms/:id/share (authenticated only)
router.patch("/:id/share", async (req, res, next) => {
  const userType = getUserType(req);
  const userId = getUserId(req);

  if (userType === "guest" || !userId) {
    // Optionally: implement guest room sharing if needed
    return res.status(403).json({ error: "Guest room sharing not supported" });
  }

  const { userId: memberUserId, role } = req.body;
  if (!memberUserId || !role) {
    return res.status(400).json({ error: "userId and role are required" });
  }
  try {
    const getResult = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.ROOMS_TABLE,
        Key: { id: req.params.id },
      })
    );
    const room = getResult.Item;
    if (!room) return res.status(404).json({ error: "Room not found" });

    let updated = false;
    let members = Array.isArray(room.members) ? room.members : [];
    members = members.map((member) => {
      if (member.userId === memberUserId) {
        updated = true;
        return { userId: memberUserId, role };
      }
      return member;
    });
    if (!updated) {
      members.push({ userId: memberUserId, role });
    }
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.ROOMS_TABLE,
        Key: { id: req.params.id },
        UpdateExpression: "SET members = :members",
        ExpressionAttributeValues: { ":members": members },
      })
    );
    res.status(200).json({ success: true, members });
  } catch (err) {
    next(err);
  }
});

export default router;
