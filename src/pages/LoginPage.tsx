import { useState, useRef } from "react";
import { app } from "../utils/cloudbase";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // Use ref for verifyOtp callback to avoid React treating it as lazy initializer
  const verifyOtpFnRef = useRef<
    | ((params: {
        phone?: string;
        token: string;
        messageId?: string;
      }) => Promise<any>)
    | null
  >(null);
  const [codeSent, setCodeSent] = useState(false);

  const sendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const auth = app.auth();
      const { data, error: apiError } = await auth.signInWithOtp({ phone });
      if (apiError) {
        const msg = apiError.message.toLowerCase();
        if (
          msg.includes("1 text message per minute") ||
          msg.includes("rate limit") ||
          msg.includes("too many")
        ) {
          setWarning("获取验证码太频繁，请稍后再试");
        } else {
          setError(apiError.message);
        }
        return;
      }
      // Store verifyOtp callback
      if (data?.verifyOtp) {
        verifyOtpFnRef.current = data.verifyOtp;
        setCodeSent(true);
        // Countdown
        let c = 60;
        setCountdown(c);
        const t = setInterval(() => {
          c--;
          setCountdown(c);
          if (c <= 0) clearInterval(t);
        }, 1000);
      } else {
        setError("发送验证码失败，请重试");
      }
    } catch (e: any) {
      const msg = (e.message || "").toLowerCase();
      if (
        msg.includes("1 text message per minute") ||
        msg.includes("rate limit")
      ) {
        setWarning("获取验证码太频繁，请稍后再试");
      } else {
        setError(e.message || "发送验证码失败");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode.trim()) {
      setError("请输入验证码");
      return;
    }
    setError("");
    setWarning("");
    setLoading(true);
    try {
      const verifyOtpFn = verifyOtpFnRef.current;
      if (!verifyOtpFn) {
        setError("请先获取验证码");
        return;
      }

      const { data, error: apiError } = await verifyOtpFn({
        token: verifyCode,
      });
      if (apiError) {
        setError(apiError.message || "验证码错误");
        return;
      }

      // Clear verify state
      verifyOtpFnRef.current = null;
      setCodeSent(false);

      // Success - sync user profile to MySQL
      const tcbUid = data?.user?.id;
      if (tcbUid) {
        if (username) {
          try {
            await app.auth().updateUser({ nickname: username });
          } catch {
            // Non-critical
          }
        }
        try {
          const { callShopApi } = await import("../api/shop");
          await callShopApi("users.sync", { tcbUid });
        } catch {
          // Non-critical
        }
      }

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "验证失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) {
      await sendCode();
    } else {
      await handleVerify();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800">商店管理系统</h1>
          <p className="mt-2 text-sm text-gray-500">
            使用手机号验证码登录（新用户自动注册）
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">手机号</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="请输入手机号"
              required
            />
          </div>
          {codeSent && (
            <div>
              <label className="mb-1 block text-sm text-gray-600">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="请输入验证码"
                  required
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={countdown > 0}
                  className="whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {countdown > 0 ? `${countdown}s` : "重新发送"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          {warning && (
            <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
              {warning}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "处理中..." : !codeSent ? "获取验证码" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
