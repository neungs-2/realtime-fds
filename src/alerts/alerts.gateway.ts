import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: '/alerts',
  cors: {
    origin: '*',
  },
})
export class AlertsGateway {
  private readonly logger = new Logger(AlertsGateway.name);

  @WebSocketServer()
  server!: Server;

  emitAnomaly(payload: unknown): void {
    this.server.emit('anomaly', payload);
  }

  afterInit(): void {
    this.logger.log('Alert gateway initialized');
  }
}
