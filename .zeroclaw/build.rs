//! Build script — compiles chat.proto for the gRPC ChatService client.
//!
//! The proto file is shared with op-chat (the server side). We reference
//! it from the op-chat proto directory so both sides stay in sync.

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_path = "../../crates/op-chat/proto/chat.proto";

    if !std::path::Path::new(proto_path).exists() {
        eprintln!("cargo:warning=chat.proto not found at {proto_path}, skipping codegen");
        return Ok(());
    }

    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .out_dir("src/proto")
        .compile(&[proto_path], &["../../crates/op-chat/proto"])?;

    println!("cargo:rerun-if-changed={}", proto_path);
    Ok(())
}
