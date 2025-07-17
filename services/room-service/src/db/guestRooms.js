import Redis from 'ioredis';
import { generateRoomId, generateRoomName } from "./roomUtils.js";

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
}

const GUEST_ROOM_TTL_SECONDS = 24 * 60 * 60;

export async function createGuestRoom(roomData = {}) {
    const id = generateRoomId();
    const name = generateRoomName();
    const language = roomData.language || "javascript";
    const createdAt = new Date().toISOString();
    const owner = "anonymous";
    const type = roomData.type || "public";
    const members = [{ userId: owner, role: 'owner' }];
    const expiresAt = Date.now() + GUEST_ROOM_TTL_SECONDS * 1000;

    const guestRoom = {
        ...roomData,
        id,
        name,
        language,
        content: roomData.content || "",
        createdAt,
        owner,
        type, 
        members,
        isGuestRoom: true,
        expiresAt,
    };
    const key = `guestroom:${id}`;
    await getRedis().set(key, JSON.stringify(guestRoom), "EX", GUEST_ROOM_TTL_SECONDS);
    return guestRoom;
}

export async function getGuestRoom(id) {
    const key = `guestroom:${id}`;
    const data = await getRedis().get(key);
    if (!data) return null;
    return JSON.parse(data);
}

export async function updateGuestRoom(id, updates) {
    const key = `guestroom:${id}`;
    const room = await getGuestRoom(id);
    if (!room) return null;
    const updatedRoom = { ...room, ...updates };
    const expiresinSec = Math.max(1, Math.floor((room.expiresAt - Date.now()) / 1000));
    await getRedis().set(key, JSON.stringify(updatedRoom), "EX", expiresinSec);
    return updatedRoom;
}
