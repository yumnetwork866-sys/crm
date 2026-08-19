import type { Response } from 'express';

interface RealtimeClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

class RealtimeHub {
  private clients: Map<string, RealtimeClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a new SSE client connection
   */
  public addClient(id: string, res: Response): void {
    // Set SSE HTTP headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering in Nginx
      'Access-Control-Allow-Origin': '*'
    });

    res.flushHeaders?.();

    // Send initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    this.clients.set(id, { id, res, connectedAt: new Date() });
    console.log(`📡 [REALTIME SSE] Client connected: ${id}. Active clients: ${this.clients.size}`);
  }

  /**
   * Remove a client connection on close
   */
  public removeClient(id: string): void {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      console.log(`🔌 [REALTIME SSE] Client disconnected: ${id}. Active clients: ${this.clients.size}`);
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  public broadcast(event: string, data: any): void {
    if (this.clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let successCount = 0;

    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
        successCount++;
      } catch (err) {
        console.warn(`[REALTIME SSE] Failed to write to client ${id}, removing:`, err);
        this.clients.delete(id);
      }
    }

    console.log(`⚡ [REALTIME SSE BROADCAST] Event "${event}" sent to ${successCount}/${this.clients.size} client(s).`);
  }

  /**
   * Keep connections alive through proxies with periodic comments/heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.clients.size === 0) return;
      const ping = `: ping - ${new Date().toISOString()}\n\n`;
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(ping);
        } catch {
          this.clients.delete(id);
        }
      }
    }, 25000); // 25s keepalive ping
  }

  /**
   * Active client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
