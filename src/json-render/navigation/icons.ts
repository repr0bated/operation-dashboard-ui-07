/**
 * String-keyed lucide-react icon registry.
 *
 * Manifest entries reference icons by name so the manifest stays JSON-safe.
 */
import type { LucideIcon } from "lucide-react";
import {
  MessageSquare, BarChart3, Link2, Radio, FileText, Clock, Folder, Zap,
  Monitor, Settings, Bug, ScrollText, Sun, Moon, Laptop, Menu, Shield,
  GitBranch, Orbit, Box, Globe, Network, Workflow, Brain, Bot, Sparkles,
  Eye, Activity, Package, Webhook, Wifi, Puzzle, AlertTriangle, Usb, Key,
  HelpCircle, Play,
} from "lucide-react";

export const iconRegistry: Record<string, LucideIcon> = {
  MessageSquare, BarChart3, Link2, Radio, FileText, Clock, Folder, Zap,
  Monitor, Settings, Bug, ScrollText, Sun, Moon, Laptop, Menu, Shield,
  GitBranch, Orbit, Box, Globe, Network, Workflow, Brain, Bot, Sparkles,
  Eye, Activity, Package, Webhook, Wifi, Puzzle, AlertTriangle, Usb, Key,
  Play,
};

export function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return HelpCircle;
  return iconRegistry[name] ?? HelpCircle;
}
