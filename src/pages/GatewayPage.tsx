import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Webhook, Wifi, Plus, Trash2 } from "lucide-react";

export default function GatewayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gateway</h1>
        <p className="text-muted-foreground">
          Manage webhooks, websockets, and gateway server settings
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Gateway Status</h3>
            <p className="text-sm text-muted-foreground">
              ZeroClaw gateway server for webhooks and websockets
            </p>
          </div>
          <Badge variant="outline">Stopped</Badge>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Start Gateway
            </Button>
            <Button variant="outline">
              <Wifi className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>

          <div className="p-4 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Gateway management coming soon. This will allow you to:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Start/stop the gateway server</li>
              <li>View active webhook endpoints</li>
              <li>Monitor websocket connections</li>
              <li>Configure gateway settings</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
