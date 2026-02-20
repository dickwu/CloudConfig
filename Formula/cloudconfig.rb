# typed: false
# frozen_string_literal: true

# This file is auto-updated by CI on each release. Do not edit manually.
class Cloudconfig < Formula
  desc "Secure cloud configuration sync server"
  homepage "https://github.com/dickwu/CloudConfig"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.0/cloudconfig-v0.1.0-aarch64-apple-darwin.tar.gz"
      sha256 "PLACEHOLDER_ARM_SHA256_UPDATED_BY_CI"
    end

    on_intel do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.0/cloudconfig-v0.1.0-x86_64-apple-darwin.tar.gz"
      sha256 "PLACEHOLDER_X86_SHA256_UPDATED_BY_CI"
    end
  end

  def install
    bin.install "cloudconfig"
  end

  service do
    run [opt_bin/"cloudconfig"]
    keep_alive true
    working_dir "#{etc}/cloudconfig"
    log_path var/"log/cloudconfig.log"
    error_log_path var/"log/cloudconfig.log"
  end

  test do
    assert_predicate bin/"cloudconfig", :exist?
  end
end
