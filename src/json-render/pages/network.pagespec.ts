/**
 * Network Control Surface — catalog-composed full-height page.
 *
 * Live: reflection tree, unary invoke (codec-gated), tonic-web streams,
 * topology from event-store, TCP probes for :8090 / Prometheus / Grafana.
 * Stub (explicitly labeled in UI): Unix socket pills; other TCP ports;
 * open-object schema form (no FDS field schemas yet).
 */
import type { Spec } from "@json-render/core";

export const networkSpec: Spec = {
  root: "root",
  elements: {
    root: {
      type: "container",
      props: {},
      children: ["header", "stubNotice", "health", "main", "stream", "topo"],
    },

    header: {
      type: "pageHeader",
      props: {
        title: "Network Control",
        subtitle:
          "Typed plugin RPCs via tonic-web · topology from event-store · legacy mirror/passthrough services hidden",
      },
    },

    stubNotice: {
      type: "callout",
      props: { variant: "warn" },
      children: ["stubNoticeText"],
    },
    stubNoticeText: {
      type: "text",
      props: {
        text: "Hidden from this explorer: DbusPassthrough, OvsdbMirror, RuntimeMirror — use operation.plugin.v1.<Plugin>PluginMethods/<Rpc> (pluginMethods.callSubid) instead. STUB markers: Unix socket pills until host_runtime.check_unix_sockets is wired; TCP ports without a browser health URL; schema form until FDS field schemas are wired.",
      },
    },

    health: {
      type: "row",
      props: {},
      children: [
        "sock-grpc",
        "sock-session",
        "sock-ovs",
        "sock-rnm",
        "tcp-tonic",
        "tcp-prometheus",
        "tcp-grafana",
        "tcp-netmaker",
        "tcp-emqx",
        "tcp-rnm",
      ],
    },

    "sock-grpc": {
      type: "socketStatusPill",
      props: { path: "/run/ghostbridge/grpc.sock", label: "ghostbridge gRPC" },
    },
    "sock-session": {
      type: "socketStatusPill",
      props: { path: "/run/opdbus/session-bus.sock", label: "session bus" },
    },
    "sock-ovs": {
      type: "socketStatusPill",
      props: { path: "/run/openvswitch/db.sock", label: "OVS DB" },
    },
    "sock-rnm": {
      type: "socketStatusPill",
      props: {
        path: "/run/rust-network-manager/rust-network-manager.sock",
        label: "RNM",
      },
    },

    "tcp-tonic": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 8090, label: "tonic-web" },
    },
    "tcp-prometheus": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 9090, label: "Prometheus" },
    },
    "tcp-grafana": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 3000, label: "Grafana" },
    },
    "tcp-netmaker": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 8081, label: "Netmaker API" },
    },
    "tcp-emqx": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 1883, label: "EMQX MQTT" },
    },
    "tcp-rnm": {
      type: "tcpHealthBadge",
      props: { host: "127.0.0.1", port: 9100, label: "RNM health" },
    },

    main: {
      type: "grid",
      props: {
        cols: 2,
        gap: 4,
        className: "grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[420px]",
      },
      children: ["tree", "callerCol"],
    },
    tree: { type: "reflectionTreeExplorer", props: { className: null } },
    callerCol: {
      type: "container",
      props: {},
      children: ["caller", "form"],
    },
    caller: { type: "grpcMethodCaller", props: { className: null } },
    form: {
      type: "schemaFormBuilder",
      props: { title: "Request editor", className: "mt-3" },
    },

    stream: { type: "grpcStreamViewer", props: { className: "mt-4" } },

    topo: {
      type: "networkTopologyGraph",
      props: { className: "mt-4", height: "360px" },
    },
  },
};
