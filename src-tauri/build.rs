fn main() {
    // Re-run this script whenever API_URL changes so that option_env! picks up
    // the new value and the binary is rebuilt with the correct endpoint.
    println!("cargo:rerun-if-env-changed=API_URL");

    if std::env::var("API_URL").is_err() {
        println!(
            "cargo:warning=API_URL is not set. \
             Remote authentication will be unavailable at runtime unless a \
             .env file with API_URL is placed next to the installed executable. \
             To bake the URL into the binary, run: \
             $env:API_URL='https://your-server.com'; npx tauri build"
        );
    }

    tauri_build::build()
}
