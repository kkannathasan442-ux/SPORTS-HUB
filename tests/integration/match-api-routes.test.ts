import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMatches, POST as postMatch } from '../../apps/web/src/app/api/matches/route';
import { GET as getMatch, PATCH as patchMatch, DELETE as deleteMatch } from '../../apps/web/src/app/api/matches/[id]/route';
import { POST as postCompetitor } from '../../apps/web/src/app/api/matches/[id]/competitors/route';
import { POST as postParticipant } from '../../apps/web/src/app/api/matches/[id]/participants/route';
import { POST as postTransition } from '../../apps/web/src/app/api/matches/[id]/transition/route';

describe('STEP 15C — Match API Routes Integration Tests', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  });

  describe('1. Authentication Order Guard on All Mutative Endpoints', () => {
    it('POST /api/matches returns 401 when unauthenticated before any payload validation', async () => {
      // Even with an invalid/empty body, unauthenticated access MUST yield 401, not 400
      const req = new NextRequest('http://localhost:3000/api/matches', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'malformed_data' }),
      });

      const res = await postMatch(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('PATCH /api/matches/[id] returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches/test-id', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'New Title' }),
      });

      const res = await patchMatch(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/matches/[id] returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches/test-id', {
        method: 'DELETE',
      });

      const res = await deleteMatch(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(401);
    });

    it('POST /api/matches/[id]/competitors returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches/test-id/competitors', {
        method: 'POST',
        body: JSON.stringify({ side: 'SIDE_A', competitorName: 'Team 1' }),
      });

      const res = await postCompetitor(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(401);
    });

    it('POST /api/matches/[id]/participants returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches/test-id/participants', {
        method: 'POST',
        body: JSON.stringify({ competitorId: 'comp-1' }),
      });

      const res = await postParticipant(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(401);
    });

    it('POST /api/matches/[id]/transition returns 401 when unauthenticated', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches/test-id/transition', {
        method: 'POST',
        body: JSON.stringify({ status: 'SCHEDULED' }),
      });

      const res = await postTransition(req, { params: { id: 'test-id' } });
      expect(res.status).toBe(401);
    });
  });

  describe('2. Read Routes and Parameter Validation', () => {
    it('GET /api/matches validates query parameters and rejects invalid limit', async () => {
      const req = new NextRequest('http://localhost:3000/api/matches?limit=-5', {
        method: 'GET',
      });

      const res = await getMatches(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it('GET /api/matches/[id] returns 404 for non-existent match id', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const req = new NextRequest(`http://localhost:3000/api/matches/${fakeUuid}`, {
        method: 'GET',
      });

      const res = await getMatch(req, { params: { id: fakeUuid } });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Match not found');
    });
  });
});
