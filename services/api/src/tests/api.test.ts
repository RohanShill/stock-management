import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { generateTokens } from '../middleware/auth.js';

describe('API Health and Authentication', () => {
  it('responds with healthy status on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('rejects unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('generates and verifies JWT tokens correctly', () => {
    const tokens = generateTokens({
      userId: 'test-user-1',
      storeId: 'test-store-1',
      username: 'owner',
      role: 'admin',
    });
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('rejects staff users from admin-only endpoints', async () => {
    const staffTokens = generateTokens({
      userId: 'staff-user-1',
      storeId: 'test-store-1',
      username: 'cashier',
      role: 'staff',
    });

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${staffTokens.accessToken}`)
      .send({ name: 'Tools' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Insufficient permission');
  });

  it('rejects invalid custom field schema payloads', async () => {
    const adminTokens = generateTokens({
      userId: 'admin-user-1',
      storeId: 'test-store-1',
      username: 'owner',
      role: 'admin',
    });

    const res = await request(app)
      .post('/api/v1/custom-fields')
      .set('Authorization', `Bearer ${adminTokens.accessToken}`)
      .send({
        // missing name, label, targetLevel, fieldType
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

