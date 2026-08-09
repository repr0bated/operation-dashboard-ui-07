import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Play, Pause } from "lucide-react";

export default function CronPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scheduled Tasks</h1>
        <p className="text-muted-foreground">
          Manage cron jobs and scheduled tasks for ZeroClaw
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Scheduled Tasks</h3>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No scheduled tasks configured</p>
          <p className="text-sm mt-2">Create tasks to run autonomously on a schedule</p>
        </div>
      </Card>
    </div>
  );
}
