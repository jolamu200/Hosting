import { useState, useMemo } from "react";
import { useNavLoader } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import {
  Search, Copy, Check, ArrowLeft, Bot, Zap, Shield,
  AlertTriangle, Rocket, ChevronDown
} from "lucide-react";

interface BotFeature {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  commands: { label: string; command: string }[];
}

const FEATURES: BotFeature[] = [
  {
    id: "autoview",
    name: "Autoview Status",
    category: "Status",
    description: "Automatically view all contacts' statuses as soon as they are posted. Be the first to view every status update.",
    tags: ["status", "view", "auto", "autoview", "first"],
    commands: [
      { label: "Enable", command: ".autoview on" },
      { label: "Also enable", command: ".enable autoview" },
      { label: "Disable", command: ".autoview off" },
      { label: "Also disable", command: ".disable autoview" },
    ],
  },
  {
    id: "autolike",
    name: "Autolike Status",
    category: "Status",
    description: "Automatically like every status update with a custom emoji of your choice. Your number reacts to all statuses instantly.",
    tags: ["status", "like", "emoji", "autolike", "react", "heart"],
    commands: [
      { label: "Enable with emoji", command: ".autolike 😍" },
      { label: "Change emoji", command: ".autolike 🔥" },
      { label: "Disable", command: ".autolike off" },
    ],
  },
  {
    id: "groupstatus",
    name: "Group Status",
    category: "Status",
    description: "Send status updates directly to a WhatsApp group so all members can see them, even without following the sender.",
    tags: ["status", "group", "forward", "groupstatus", "share"],
    commands: [
      { label: "Enable", command: ".groupstatus on" },
      { label: "Disable", command: ".groupstatus off" },
      { label: "Set group (run in group)", command: ".setstatusgroup" },
    ],
  },
  {
    id: "antidelete",
    name: "Anti-Delete",
    category: "Anti-Delete",
    description: "Retrieve any deleted message and view its original content. When someone deletes a message, your bot secretly saves and sends it to you.",
    tags: ["delete", "antidelete", "retrieve", "deleted", "messages", "recover"],
    commands: [
      { label: "Enable", command: ".antidelete on" },
      { label: "Disable", command: ".antidelete off" },
    ],
  },
  {
    id: "viewonce",
    name: "View Once Recovery",
    category: "Anti-Delete",
    description: "View once photos and videos sent to you are secretly forwarded to your DM before they disappear. Never miss a view-once media again.",
    tags: ["viewonce", "view", "once", "media", "secret", "dm", "photo", "video", "recover"],
    commands: [
      { label: "Enable", command: ".viewonce on" },
      { label: "Disable", command: ".viewonce off" },
    ],
  },
  {
    id: "welcome",
    name: "Welcome Message",
    category: "Group Management",
    description: "Automatically welcome new members to your group with a custom message when they join. Set a personalized welcome message.",
    tags: ["welcome", "group", "members", "join", "message", "greet", "new"],
    commands: [
      { label: "Enable", command: ".welcome on" },
      { label: "Disable", command: ".welcome off" },
      { label: "Set message", command: ".setwelcome Welcome to the group, @user! 🎉" },
      { label: "Reset to default", command: ".setwelcome reset" },
    ],
  },
  {
    id: "goodbye",
    name: "Goodbye Message",
    category: "Group Management",
    description: "Send a farewell message when members leave the group. Keep your group engaged and professional.",
    tags: ["goodbye", "bye", "group", "members", "leave", "farewell"],
    commands: [
      { label: "Enable", command: ".goodbye on" },
      { label: "Disable", command: ".goodbye off" },
      { label: "Set message", command: ".setgoodbye Goodbye @user, we'll miss you! 👋" },
      { label: "Reset to default", command: ".setgoodbye reset" },
    ],
  },
  {
    id: "antilink",
    name: "Anti-Link",
    category: "Security",
    description: "Automatically delete any links shared in your group. You can whitelist specific domains you want to allow.",
    tags: ["antilink", "link", "security", "spam", "delete", "block", "url"],
    commands: [
      { label: "Enable", command: ".antilink on" },
      { label: "Disable", command: ".antilink off" },
      { label: "Allow a domain", command: ".allowlink example.com" },
      { label: "Remove allowed domain", command: ".removelink example.com" },
    ],
  },
  {
    id: "broadcast",
    name: "Broadcast to Groups",
    category: "Group Management",
    description: "Send a single message to all WhatsApp groups your bot is in simultaneously. Perfect for important announcements.",
    tags: ["broadcast", "groups", "announce", "message", "all", "send", "mass"],
    commands: [
      { label: "Broadcast", command: ".broadcast <your message>" },
      { label: "Example", command: ".broadcast Hey everyone! 🎉 Don't forget about tonight's event!" },
    ],
  },
  {
    id: "autoreply",
    name: "Auto-Reply",
    category: "Auto-Reply",
    description: "Your bot automatically replies to messages with intelligent responses. Set custom keyword triggers with specific replies — similar to an LLM assistant.",
    tags: ["autoreply", "reply", "auto", "keyword", "llm", "ai", "respond", "bot"],
    commands: [
      { label: "Enable", command: ".autoreply on" },
      { label: "Disable", command: ".autoreply off" },
      { label: "Set keyword reply", command: ".setreply hello Hi there! How can I help you?" },
      { label: "Remove keyword", command: ".removereply hello" },
    ],
  },
  {
    id: "antispam",
    name: "Anti-Spam",
    category: "Security",
    description: "Automatically detect and warn or remove users who send too many messages in a short period. Keep your group clean and organised.",
    tags: ["antispam", "spam", "security", "flood", "group", "protect"],
    commands: [
      { label: "Enable", command: ".antispam on" },
      { label: "Disable", command: ".antispam off" },
      { label: "Set message limit per minute", command: ".spammsg 10" },
    ],
  },
  {
    id: "tagall",
    name: "Tag All Members",
    category: "Group Management",
    description: "Mention all group members in one message. Great for important announcements that need everyone's attention.",
    tags: ["tagall", "mention", "all", "group", "announce", "notify", "ping"],
    commands: [
      { label: "Tag all", command: ".tagall <message>" },
      { label: "Example", command: ".tagall Please read the pinned message!" },
    ],
  },
  {
    id: "ping",
    name: "Ping / Speed Check",
    category: "General",
    description: "Check your bot's response speed and connection status. Make sure your bot is running smoothly at all times.",
    tags: ["ping", "speed", "check", "latency", "status", "bot", "connection"],
    commands: [
      { label: "Check speed", command: ".ping" },
      { label: "Also", command: ".speed" },
    ],
  },
  {
    id: "menu",
    name: "Bot Menu",
    category: "General",
    description: "Display all available bot commands and features in a formatted menu. Great for discovering everything your bot can do.",
    tags: ["menu", "help", "commands", "list", "all"],
    commands: [
      { label: "Show menu", command: ".menu" },
      { label: "Also", command: ".help" },
    ],
  },
  {
    id: "info",
    name: "Bot Info",
    category: "General",
    description: "Display information about your bot instance including runtime, memory usage, uptime, and version.",
    tags: ["info", "about", "version", "bot", "uptime"],
    commands: [
      { label: "Show info", command: ".info" },
      { label: "Also", command: ".botinfo" },
    ],
  },
];

const CATEGORIES = ["All", "Status", "Anti-Delete", "Group Management", "Auto-Reply", "Security", "General"];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      aria-label="Copy command"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function FeatureCard({ feature }: { feature: BotFeature }) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-teal-500/30 transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-teal-500/10 border border-teal-500/20">
            <Zap className="w-4 h-4 text-teal-400" />
          </div>
          <h3 className="font-semibold text-sm leading-tight pt-2">{feature.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commands</p>
          <div className="space-y-1.5">
            {feature.commands.map((cmd) => (
              <div key={cmd.command} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground shrink-0">{cmd.label}:</span>
                  <code className="text-xs font-mono text-foreground truncate">{cmd.command}</code>
                </div>
                <CopyButton text={cmd.command} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    }

export function BotFeatures() {
  const { navigateWithLoader } = useNavLoader();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FEATURES.filter((f) => {
      const matchCat = category === "All" || f.category === category;
      if (!matchCat) return false;
      if (!q) return true;
      const haystack = [
        f.name,
        f.description,
        f.category,
        ...f.tags,
        ...f.commands.map((c) => c.command),
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [search, category]);


  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />

      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => navigateWithLoader("/")}
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <AppLogoIcon className="w-5 h-5 text-primary" />
                <span className="font-bold text-base">Bot Features & Help</span>
              </div>
            </div>
            <Button
              size="sm"
              className="hidden sm:flex bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0 gap-1.5"
              onClick={() => navigateWithLoader("/services/bots")}
            >
              <Rocket className="w-3.5 h-3.5" />
              Try Free Trial
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-teal-600/10 to-orange-600/10 border border-teal-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Try Bmb Bot for Free</p>
              <p className="text-xs text-muted-foreground">Deploy a free trial bot and test all features instantly — no TX needed.</p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0 gap-1.5"
            onClick={() => navigateWithLoader("/services/bots")}
          >
            <Rocket className="w-3.5 h-3.5" />
            Start Free Trial
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Bot Features & Help</h1>
          <p className="text-muted-foreground text-sm">Everything you can do with Bmb Bot. Search, explore, and copy commands.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search features, commands, or keywords... (e.g. 'status', 'delete', 'group')"
              className="pl-9"
            />
          </div>
          <div className="relative sm:w-52">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none h-10 rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <p className="mb-5 text-sm text-muted-foreground">{filtered.length} feature{filtered.length !== 1 ? "s" : ""}</p>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium mb-1">No features found</p>
            <p className="text-sm text-muted-foreground">Try a different search term or category.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setCategory("All"); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {filtered.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        )}

        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 flex gap-4 items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm mb-1">Disclaimer</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bmb Tech Hosting provides support exclusively for <span className="text-foreground font-medium">Bmb Bot</span>.
              For other WhatsApp bots, we are unable to provide assistance as we do not own or maintain them.
              Commands and features shown here apply specifically to Bmb Bot.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-teal-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Ready to experience Bmb Bot?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Deploy a free trial bot instantly — no TX coins required to get started.</p>
            </div>
          </div>
          <Button
            size="sm"
            className="shrink-0 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0 gap-1.5"
            onClick={() => navigateWithLoader("/services/bots")}
          >
            <Rocket className="w-3.5 h-3.5" />
            Start Free Trial
          </Button>
        </div>
      </main>
    </div>
  );
}
