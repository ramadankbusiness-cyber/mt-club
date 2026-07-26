import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/supabase.js", () => {
  const handler = {
    get(target, prop) {
      if (prop === "_data" || prop === "_error") return target[prop];
      if (prop === "then") {
        return (resolve, reject) => {
          const p = Promise.resolve({ data: target._data, error: target._error });
          return p.then(resolve, reject);
        };
      }
      if (prop === "single" || prop === "maybeSingle") {
        return () => Promise.resolve({ data: target._data, error: target._error });
      }
      return (...args) => {
        return new Proxy(target, handler);
      };
    },
  };

  function makeChain(data = null, error = null) {
    const base = { _data: data, _error: error };
    return new Proxy(base, handler);
  }

  return {
    supabase: {
      from: vi.fn(() => makeChain([], null)),
    },
  };
});

import { calculateUserPoints, calculateLeaderboard } from "../../utils/points.js";
import { supabase } from "../../config/supabase.js";

describe("calculateUserPoints", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 0 for user with no attendance", async () => {
    const chain = { _data: [], _error: null };
    supabase.from.mockReturnValue(new Proxy(chain, {
      get(t, p) {
        if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
        if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
        return (...a) => new Proxy(t, this);
      }
    }));

    const result = await calculateUserPoints(1);
    expect(result.total).toBe(0);
    expect(result.attendanceCount).toBe(0);
  });

  it("calculates attendance points correctly (count * 2)", async () => {
    const attendanceData = [{ event_id: 1 }, { event_id: 2 }, { event_id: 3 }];
    let call = 0;
    supabase.from.mockImplementation(() => {
      call++;
      const data = call === 1 ? attendanceData : [];
      return new Proxy({ _data: data, _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateUserPoints(1);
    expect(result.attendanceCount).toBe(3);
    expect(result.attendancePoints).toBe(6);
    expect(result.total).toBe(6);
  });

  it("includes adjustment points", async () => {
    const attendanceData = [{ event_id: 1 }];
    const txnsData = [
      { id: 1, points: 5, transaction_type: "bonus", reason: "Good", created_at: "2024-01-01", event_id: null, created_by: 1 },
      { id: 2, points: -2, transaction_type: "penalty", reason: "Late", created_at: "2024-01-02", event_id: null, created_by: 1 },
    ];
    let call = 0;
    supabase.from.mockImplementation(() => {
      call++;
      const data = call === 1 ? attendanceData : txnsData;
      return new Proxy({ _data: data, _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateUserPoints(1);
    expect(result.attendancePoints).toBe(2);
    expect(result.adjustmentPoints).toBe(3);
    expect(result.total).toBe(5);
  });

  it("filters out attendance-type transactions from adjustments", async () => {
    const attendanceData = [{ event_id: 1 }];
    const txnsData = [
      { id: 1, points: 2, transaction_type: "attendance", reason: "Event", created_at: "2024-01-01", event_id: 1, created_by: null },
      { id: 2, points: 5, transaction_type: "bonus", reason: "Bonus", created_at: "2024-01-02", event_id: null, created_by: 1 },
    ];
    let call = 0;
    supabase.from.mockImplementation(() => {
      call++;
      const data = call === 1 ? attendanceData : txnsData;
      return new Proxy({ _data: data, _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateUserPoints(1);
    expect(result.adjustmentPoints).toBe(5);
    expect(result.total).toBe(7);
  });
});

describe("calculateLeaderboard", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty array for no data", async () => {
    supabase.from.mockImplementation(() => {
      return new Proxy({ _data: [], _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateLeaderboard();
    expect(result).toEqual([]);
  });

  it("sorts by points descending", async () => {
    const attendance = [
      { member_id: 1, event_id: 1 },
      { member_id: 1, event_id: 2 },
      { member_id: 2, event_id: 1 },
    ];
    const users = [
      { id: 1, name: "Alice", role: "member", has_image: 0, academic_number: "A001", enabled: 1 },
      { id: 2, name: "Bob", role: "member", has_image: 0, academic_number: "A002", enabled: 1 },
    ];
    let call = 0;
    supabase.from.mockImplementation(() => {
      call++;
      const data = call === 1 ? attendance : call === 2 ? users : [];
      return new Proxy({ _data: data, _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateLeaderboard();
    expect(result[0].id).toBe(1);
    expect(result[0].points).toBe(4);
    expect(result[1].id).toBe(2);
    expect(result[1].points).toBe(2);
  });

  it("includes adjustment points in leaderboard", async () => {
    const attendance = [{ member_id: 1, event_id: 1 }];
    const users = [
      { id: 1, name: "Alice", role: "member", has_image: 0, academic_number: "A001", enabled: 1 },
      { id: 2, name: "Bob", role: "member", has_image: 0, academic_number: "A002", enabled: 1 },
    ];
    const txns = [
      { user_id: 2, points: 10, transaction_type: "bonus" },
    ];
    let call = 0;
    supabase.from.mockImplementation(() => {
      call++;
      const data = call === 1 ? attendance : call === 2 ? users : txns;
      return new Proxy({ _data: data, _error: null }, {
        get(t, p) {
          if (p === "then") return (r) => Promise.resolve({ data: t._data, error: t._error }).then(r);
          if (p === "single" || p === "maybeSingle") return () => Promise.resolve({ data: t._data, error: t._error });
          return (...a) => new Proxy(t, this);
        }
      });
    });

    const result = await calculateLeaderboard();
    expect(result[0].id).toBe(2);
    expect(result[0].points).toBe(10);
    expect(result[1].id).toBe(1);
    expect(result[1].points).toBe(2);
  });
});
