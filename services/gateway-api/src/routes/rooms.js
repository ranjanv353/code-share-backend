import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/:id', async (req, res, next) => {
    const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
    try {
        const response = await axios.get(`${ROOM_SERVICE_URL}/rooms/${req.params.id}`);
        res.status(response.status).json(response.data);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
    try {
        const response = await axios.post(`${ROOM_SERVICE_URL}/rooms`, req.body);
        res.status(response.status).json(response.data);
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', async (req, res, next) => {
    const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
    try {
        const response = await axios.patch(
            `${ROOM_SERVICE_URL}/rooms/${req.params.id}`,
            req.body
        );
        res.status(response.status).json(response.data);
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/share', async (req, res, next) => {
    const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL;
    try {
        const response = await axios.patch(
            `${ROOM_SERVICE_URL}/rooms/${req.params.id}/share`,
            req.body
        );
        res.status(response.status).json(response.data);
    } catch (err) {
        next(err);
    }
});

export default router;
