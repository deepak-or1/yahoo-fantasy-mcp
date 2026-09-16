import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  getYahooAccessToken: vi.fn(),
  refreshYahooAccessToken: vi.fn(),
}));

vi.mock("@/lib/session", () => session);

import { BASE_URL, yahooGet } from "@/lib/yahoo";

describe("yahooGet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.getYahooAccessToken.mockResolvedValue("first-token");
    session.refreshYahooAccessToken.mockResolvedValue("fresh-token");
  });

  it("adds format=json and sends the bearer and accept headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ fantasy_content: { league: { name: "Test" } } }), {
        status: 200,
      }),
    );

    await yahooGet("user-1", "league/key?foo=bar", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(`${BASE_URL}league/key?foo=bar&format=json`, {
      headers: { Authorization: "Bearer first-token", Accept: "application/json" },
    });
  });

  it("refreshes and retries once after a 401", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ fantasy_content: { league: { name: "Test" } } }), {
          status: 200,
        }),
      );

    await yahooGet("user-1", "league/key", fetchImpl);

    expect(session.refreshYahooAccessToken).toHaveBeenCalledOnce();
    expect(session.refreshYahooAccessToken).toHaveBeenCalledWith("user-1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1]).toEqual({
      headers: { Authorization: "Bearer fresh-token", Accept: "application/json" },
    });
  });

  it("throws non-2xx status and response text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("server exploded", { status: 500 }));
    await expect(yahooGet("user-1", "league/key", fetchImpl)).rejects.toThrow(
      "Yahoo API 500 for league/key: server exploded",
    );
  });

  it("strips Yahoo wrapper keys", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          fantasy_content: {
            "xml:lang": "en-US",
            "yahoo:uri": "/uri",
            time: "1ms",
            copyright: "Yahoo",
            refresh_rate: "60",
            league: { name: "Test" },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(yahooGet("user-1", "league/key", fetchImpl)).resolves.toEqual({
      league: { name: "Test" },
    });
  });
});
