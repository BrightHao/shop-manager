import { describe, it, expect } from "vitest";

// Mirror of the extractUser function from AuthContext
function extractUser(session: any): { uid: string; username?: string } | null {
  const uid =
    session.user?.uid || session.uid || session.user?.id || session.sub || "";
  const uname =
    session.user?.username ||
    session.username ||
    session.user?.user_metadata?.username ||
    session.user?.user_metadata?.name ||
    session.user?.user_metadata?.nickName ||
    session.user?.user_metadata?.nickname ||
    "";
  return uid ? { uid, username: uname } : null;
}

describe("extractUser logic", () => {
  it("extracts uid from session.user.uid", () => {
    const result = extractUser({ user: { uid: "test-uid-123" } });
    expect(result).toEqual({ uid: "test-uid-123", username: "" });
  });

  it("extracts uid from session.uid fallback", () => {
    const result = extractUser({ uid: "direct-uid" });
    expect(result).toEqual({ uid: "direct-uid", username: "" });
  });

  it("extracts uid from session.user.id fallback", () => {
    const result = extractUser({ user: { id: "fallback-id" } });
    expect(result).toEqual({ uid: "fallback-id", username: "" });
  });

  it("extracts uid from session.sub fallback", () => {
    const result = extractUser({ sub: "sub-uid" });
    expect(result).toEqual({ uid: "sub-uid", username: "" });
  });

  it("returns null when no uid found", () => {
    const result = extractUser({});
    expect(result).toBeNull();
  });

  it("extracts username from session.user.username", () => {
    const result = extractUser({ user: { uid: "uid", username: "testuser" } });
    expect(result).toEqual({ uid: "uid", username: "testuser" });
  });

  it("extracts username from session.username", () => {
    const result = extractUser({ uid: "uid", username: "plain-username" });
    expect(result).toEqual({ uid: "uid", username: "plain-username" });
  });

  it("extracts username from user_metadata.username", () => {
    const result = extractUser({
      user: { uid: "uid", user_metadata: { username: "meta-user" } },
    });
    expect(result).toEqual({ uid: "uid", username: "meta-user" });
  });

  it("extracts username from user_metadata.nickName", () => {
    const result = extractUser({
      user: { uid: "uid", user_metadata: { nickName: "nickname" } },
    });
    expect(result).toEqual({ uid: "uid", username: "nickname" });
  });

  it("extracts username from user_metadata.nickname", () => {
    const result = extractUser({
      user: { uid: "uid", user_metadata: { nickname: "mysnick" } },
    });
    expect(result).toEqual({ uid: "uid", username: "mysnick" });
  });

  it("prioritizes user.username over user_metadata.username", () => {
    const result = extractUser({
      user: {
        uid: "uid",
        username: "plain",
        user_metadata: { username: "meta", nickName: "nick" },
      },
    });
    // user.username is checked BEFORE user_metadata.username
    expect(result).toEqual({ uid: "uid", username: "plain" });
  });

  it("handles full session with all fields", () => {
    const result = extractUser({
      user: {
        uid: "full-session-uid",
        username: "admin",
        user_metadata: { name: "Admin User" },
      },
    });
    expect(result).toEqual({ uid: "full-session-uid", username: "admin" });
  });
});
