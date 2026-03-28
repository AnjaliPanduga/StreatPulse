import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import * as h3 from 'h3-js';
import { getAllActiveRisks, RiskResult } from '../engine/riskScorer';
import { generateAlert, shouldTriggerAlert } from '../engine/alertEngine';

let io: Server | null = null;

export function initSocketManager(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', async (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    try {
      const risks = await getAllActiveRisks();
      socket.emit('risk:batch', risks);
    } catch (err) {
      console.error('[Socket] Error sending initial risks:', err);
    }

    socket.on('location:check', async (data: { lat: number; lng: number }) => {
      try {
        const userH3 = h3.latLngToCell(data.lat, data.lng, 9);
        const neighbors = h3.gridDisk(userH3, 1);
        const risks = await getAllActiveRisks();

        const nearbyRisks = risks.filter(r => neighbors.includes(r.h3Index));
        const highRisk = nearbyRisks.find(r => shouldTriggerAlert(r));

        if (highRisk) {
          const alert = generateAlert(highRisk);
          if (alert) {
            socket.emit('alert:enter-zone', alert);
          }
        }
      } catch (err) {
        console.error('[Socket] Location check error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketManager(): Server | null {
  return io;
}

export function broadcastRiskUpdate(risk: RiskResult): void {
  if (!io) return;

  io.emit('risk:update', {
    h3Index: risk.h3Index,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    centerLat: risk.centerLat,
    centerLng: risk.centerLng,
    slowdownCount: risk.slowdownCount,
    rerouteCount: risk.rerouteCount,
    dangerTapCount: risk.dangerTapCount,
    uniqueUsers: risk.uniqueUsers,
  });
}
