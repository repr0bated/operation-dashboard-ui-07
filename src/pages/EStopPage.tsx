import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield } from "lucide-react";

export default function EStopPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emergency Stop</h1>
        <p className="text-muted-foreground">
          Engage, inspect, and resume emergency-stop states
        </p>
      </div>

      <Card className="p-6 border-destructive">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h3 className="text-lg font-semibold">Emergency Stop Status</h3>
            <p className="text-sm text-muted-foreground">Currently inactive</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Emergency stop will immediately halt all ZeroClaw operations. Use with caution.
          </p>
          <Button variant="destructive">
            <Shield className="h-4 w-4 mr-2" />
            Engage Emergency Stop
          </Button>
        </div>
      </Card>
    </div>
  );
}
