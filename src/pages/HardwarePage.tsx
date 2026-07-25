import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Usb, RefreshCw } from "lucide-react";

export default function HardwarePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hardware</h1>
        <p className="text-muted-foreground">
          Discover and introspect USB hardware and peripherals
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Connected Devices</h3>
          <Button size="sm" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Scan
          </Button>
        </div>

        <div className="text-center py-8 text-muted-foreground">
          <Usb className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No USB devices detected</p>
          <p className="text-sm mt-2">Connect hardware to see it listed here</p>
        </div>
      </Card>
    </div>
  );
}
