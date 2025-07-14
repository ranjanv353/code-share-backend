import express from "express";
import { nanoid } from "nanoid";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import ddbDocClient from "../db/dynamo.js";
import { PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const router = express.Router();

router.post("/", async (req, res, next) => {
  const id = nanoid(6);
  const name = uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    style: "capital",
    separator: " ",
  });
  const language = "javascript";
  const createdAt = new Date().toISOString();

  const owner = "anonymous";
  const type = "public";
  const members = [{ userId: owner, role: "owner" }];

  const item = {
    id,
    name,
    language,
    content: "",
    createdAt,
    owner,
    type,
    members,
  };

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.ROOMS_TABLE,
        Item: item,
      })
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.ROOMS_TABLE,
        Key: { id: req.params.id },
      })
    );
    if (!result.Item) return res.status(404).json({ error: "Room not found" });
    res.json(result.Item);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  const allowedFields = ["name", "language", "type", "content"];
  const updateFields = {};
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) updateFields[key] = req.body[key];
  }
  if (Object.keys(updateFields).length == 0) {
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

  try {
    const params = {
      TableName: process.env.ROOMS_TABLE,
      Key: { id: req.params.id },
      UpdateExpression: "SET " + updateExpr.join(", "),
      ExpressionAttributeValues: exprAttrVals,
      ExpressionAttributeNames: exprAttrNames,
      ReturnValues: "ALL_NEW",
    };
    const result = await ddbDocClient.send(new UpdateCommand(params));
    res.json(result.Attributes);
  } catch (err) {
    next(err);
  }
});


router.patch("/:id/share", async(req, res, next) => {
    const {userId, role} = req.body;
    if(!userId || !role){
        return res.status(400).json({error: 'userId and role are required'});
    }
    try{
        const getResult = await ddbDocClient.send(new GetCommand({
            TableName: process.env.ROOMS_TABLE,
            Key: {id: req.params.id}
        }));
        const room = getResult.Item;
        if(!room) return res.status(404).json({error: 'Room not found'});
       
        let updated = false;
        let members = Array.isArray(room.members) ? room.members : [];
        members = members.map(member => {
            if(member.userId === userId){
                updated  = true;
                return {userId, role};
            }
            return member;
        });
        if(!updated){
            members.push({userId, role});
        }
        await ddbDocClient.send(new UpdateCommand({
            TableName: process.env.ROOMS_TABLE,
            Key: {id: req.params.id},
            UpdateExpression: 'SET members = :members',
            ExpressionAttributeValues: {':members': members}
        }));
        res.status(200).json({success: true, members});
    }
    catch(err){
        next(err);
    }
});

export default router;
