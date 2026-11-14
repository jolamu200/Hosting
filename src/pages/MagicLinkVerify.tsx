import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";

type Status = "loading" | "needs-username" | "success" | "error";

export function MagicLinkVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [username, setUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("No token found in URL.");
      return;
    }

    fetch(`/api/auth/magic-link/verify?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.needsUsername && data.pendingToken) {
          setPendingToken(data.pendingToken);
          setStatus("needs-username");
        } else if (data.token && data.user) {
          authLogin(data.token, data.user);
          setStatus("success");
          setTimeout(() => navigate("/dashboard"), 2000);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Invalid or expired link.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again.");
      });
  }, []);

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { showToast("Please enter a username", "error"); return; }
    if (username.length < 3 || username.length > 20) { showToast("Username must be 3-20 characters", "error"); return; }
    if (!/^[a-z0-9_]+$/i.test(username)) { showToast("Letters, numbers, underscores only", "error"); return; }
    setUsernameLoading(true);
    try {
      const res = await fetch("/api/auth/set-username", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pendingToken}` },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        authLogin(data.token, data.user);
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        showToast(data.error || "Failed to set username", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleSkipUsername = async () => {
    setSkipLoading(true);
    try {
      const res = await fetch("/api/auth/set-username", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pendingToken}` },
        body: JSON.stringify({ username: "" }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        authLogin(data.token, data.user);
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        showToast(data.error || "Failed to create account", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSkipLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />
      <div className="min-h-screen flex items-center justify-center p-4 relative z-[1]">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <AppLogoIcon className="w-6 h-6 text-primary" />
            </div>

            {status === "loading" && (
              <>
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground text-sm">Verifying your link...</p>
              </>
            )}

            {status === "needs-username" && (
              <div className="space-y-4 text-left">
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <h2 className="text-xl font-bold">Email Verified!</h2>
                  <p className="text-sm text-muted-foreground mt-1">Pick a username to finish setting up your account.</p>
                </div>
                <form onSubmit={handleSetUsername} className="space-y-3">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, ""))}
                      placeholder="Choose a username"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground mt-1">3-20 characters, letters, numbers, underscores only</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={usernameLoading || skipLoading}>
                    {usernameLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Finish Setup
                  </Button>
                </form>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs text-muted-foreground uppercase">
                    <span className="bg-card px-2">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground text-sm"
                  onClick={handleSkipUsername}
                  disabled={skipLoading || usernameLoading}
                >
                  {skipLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Skip — assign me a random username
                </Button>
              </div>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                <h2 className="text-xl font-bold">You're in!</h2>
                <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="w-10 h-10 text-red-400 mx-auto" />
                <h2 className="text-xl font-bold">Link Expired</h2>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
                <Button className="w-full" onClick={() => navigate("/signup")}>
                  Back to Signup
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
