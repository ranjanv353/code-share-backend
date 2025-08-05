import express from 'express';
import axios from 'axios';

const router = express.Router();

function userHeaders(req) {
  return {
    'x-user-id': req.user ? req.user.sub : undefined,
    'x-user-type': req.user ? 'auth' : 'guest',
    'x-user-email': req.user ? req.userEmail : undefined
  };
}
// GET /rooms (list all rooms for authenticated user)
router.get('/', async (req, res, next) => {
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.get(
      `${ROOM_SERVICE_URL}/rooms`,
      { headers: userHeaders(req) }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

// GET /rooms/:id (get single room)
router.get('/:id', async (req, res, next) => {
  console.log('Gateway headers sent:', {
  authorization: req.headers.authorization,
  'x-id-token': req.headers['x-id-token'],
  'x-user-email': req.headers['x-user-email'], // this comes from decoded token in middleware
});
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.get(
      `${ROOM_SERVICE_URL}/rooms/${req.params.id}`,
      { headers: userHeaders(req) }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

// POST /rooms (create room)
router.post('/', async (req, res, next) => {
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.post(
      `${ROOM_SERVICE_URL}/rooms`,
      req.body,
      { headers: userHeaders(req) }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

// PATCH /rooms/:id (update room)
router.patch('/:id', async (req, res, next) => {
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.patch(
      `${ROOM_SERVICE_URL}/rooms/${req.params.id}`,
      req.body,
      { headers: userHeaders(req) }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

// PATCH /rooms/:id/share (share room)
router.patch('/:id/share', async (req, res, next) => {
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.patch(
      `${ROOM_SERVICE_URL}/rooms/${req.params.id}/share`,
      req.body,
      { headers: userHeaders(req) }
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

// DELETE /rooms/:id (delete room)
router.delete('/:id', async (req, res, next) => {
  const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
  try {
    const response = await axios.delete(
      `${ROOM_SERVICE_URL}/rooms/${req.params.id}`,
      { headers: userHeaders(req) }
    );
    // 204 No Content returns empty, but for consistency, just send status
    res.sendStatus(response.status);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      next(err);
    }
  }
});

export default router;
