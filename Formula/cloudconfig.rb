# typed: false
# frozen_string_literal: true

# This file is auto-updated by CI on each release. Do not edit manually.
class Cloudconfig < Formula
  desc "Secure cloud configuration sync server"
  homepage "https://github.com/dickwu/CloudConfig"
  version "0.1.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.2/cloudconfig-v0.1.2-aarch64-apple-darwin.tar.gz"
      sha256 "823cd3a54ae74fe6faa083e5639834763526b61636164f58872bceae6878ebce"
    end

    on_intel do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.2/cloudconfig-v0.1.2-x86_64-apple-darwin.tar.gz"
      sha256 "a8f710d0fedbe84bc26eacc60bff6e0dec5f22e4fe3233dd0ecfd1e421e8e86c"
    end
  end

  def install
    bin.install "cloudconfig"
  end

  def post_install
    (etc/"cloudconfig").mkpath
    (var/"lib/cloudconfig").mkpath

    env_path = etc/"cloudconfig/.env"
    unless env_path.exist?
      env_path.write <<~EOS
        LISTEN_ADDR=127.0.0.1:8080
        TURSO_URL=#{var}/lib/cloudconfig/cloudconfig.db
        TURSO_AUTH_TOKEN=
        MAX_CLOCK_DRIFT_SECONDS=300
        MAX_BODY_SIZE_BYTES=1048576
      EOS
    end

    cd etc/"cloudconfig" do
      system opt_bin/"cloudconfig", "init"
    end
  end

  service do
    run [opt_bin/"cloudconfig", "start"]
    keep_alive true
    working_dir "#{etc}/cloudconfig"
    log_path var/"log/cloudconfig.log"
    error_log_path var/"log/cloudconfig.log"
  end

  test do
    assert_predicate bin/"cloudconfig", :exist?
  end
end
