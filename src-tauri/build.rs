fn main() {
    // lib.rs 用 option_env!("NEXT_PUBLIC_API_BASE_URL") 判断 open_external 能否放行 http 网关;换地址要重编
    println!("cargo:rerun-if-env-changed=NEXT_PUBLIC_API_BASE_URL");
    tauri_build::build()
}
