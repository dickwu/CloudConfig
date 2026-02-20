use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "cloudconfig",
    bin_name = "cloudconfig",
    about = "Secure cloud configuration sync server"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Init,
    Start,
    Reset,
    Status,
}
