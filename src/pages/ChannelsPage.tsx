import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, Settings } from "lucide-react";

const CHANNELS = [
  { name: "Telegram", configured: false, icon: "📱" },
  { name: "Discord", configured: false, icon: "💬" },
  { name: "Slack", configured: false, icon: "💼" },
  { name: "Matrix", configured: false, icon: "🎭" },
  { name: "Signal", configured: false, icon: "📶" },
  { name: "WhatsApp", configured: false, icon: "💚" },
  { name: "Email", configured: false, icon: "📧" },
  { name: "Webhook", configured: false, icon: "🔗" },
];

export default function ChannelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Channels</h1>
        <p className="text-muted-foreground">
          Configure communication channels for 3tched Router
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((channel) => (
          <Card key={channel.name} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{channel.icon}</span>
                <h3 className="font-semibold">{channel.name}</h3>
              </div>
              <Badge variant={channel.configured ? "default" : "secondary"}>
                {channel.configured ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
