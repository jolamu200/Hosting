import { useState, useEffect } from "react";
  import { useSearchParams, useNavigate } from "react-router";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { useToast } from "@/hooks/useToast";
  import { TechBackground } from "@/components/TechBackground";
  import { AppLogoIcon } from "@/components/AppLogo";
  import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

  type Status = "form" | "success" | "invalid";

  export function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [status, setStatus] = useState<Status>("form");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [tokenValid, setTokenValid] = useState(true);

    const resetToken = searchParams.get("token");

    useEffect(() => {
      if (!resetToken) setTokenValid(false);
    }, [resetToken]);

    const handleReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) { showToast("Please enter a new password", "error"); return; }
      if (password.length < 8) { showToast("Password must be at least 8 characters", "error"); return; }
      if (password !== confirm) { showToast("Passwords do not match", "error"); return; }
      if (!resetToken) { showToast("Invalid reset link", "error"); return; }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
        } else {
          if (data.error?.includes("expired") || data.error?.includes("invalid")) {
            setStatus("invalid");
          } else {
            showToast(data.error || "Failed to reset password", "error");
          }
        }
      } catch {
        showToast("Something went wrong. Please try again.", "error");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-background relative">
        <TechBackground />
        <div className="min-h-screen flex items-center justify-center p-4 relative z-[1]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <AppLogoIcon className="w-6 h-6 text-primary" />
              </div>
              {status === "form" && tokenValid && (
                <>
                  <CardTitle className="text-2xl">Set New Password</CardTitle>
                  <CardDescription>Choose a strong password for your account</CardDescription>
                </>
              )}
            </CardHeader>

            <CardContent>
              {!tokenValid && (
                <div className="text-center space-y-4 py-4">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto" />
                  <p className="font-semibold">Invalid Reset Link</p>
                  <p className="text-sm text-muted-foreground">This link is missing a token. Please request a new password reset.</p>
                  <Button className="w-full" onClick={() => navigate("/login")}>
                    Back to Login
                  </Button>
                </div>
              )}

              {status === "invalid" && (
                <div className="text-center space-y-4 py-4">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto" />
                  <p className="font-semibold">Link Expired</p>
                  <p className="text-sm text-muted-foreground">This reset link has expired or already been used. Please request a new one.</p>
                  <Button className="w-full" onClick={() => navigate("/login")}>
                    Request New Reset Link
                  </Button>
                </div>
              )}

              {status === "success" && (
                <div className="text-center space-y-4 py-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                  <p className="font-semibold text-lg">Password Reset!</p>
                  <p className="text-sm text-muted-foreground">Your password has been updated successfully. You can now log in with your new password.</p>
                  <Button className="w-full" onClick={() => navigate("/login")}>
                    Go to Login
                  </Button>
                </div>
              )}

              {status === "form" && tokenValid && (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="new-password"
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type={showPass ? "text" : "password"}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Reset Password
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Remembered it?{" "}
                    <button type="button" onClick={() => navigate("/login")} className="text-primary hover:underline font-medium">
                      Back to Login
                    </button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  