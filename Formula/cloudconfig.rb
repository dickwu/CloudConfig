# typed: false
# frozen_string_literal: true

# This file is auto-updated by CI on each release. Do not edit manually.
class Cloudconfig < Formula
  desc "Secure cloud configuration sync server"
  homepage "https://github.com/dickwu/CloudConfig"
  version "0.1.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.1/cloudconfig-v0.1.1-aarch64-apple-darwin.tar.gz"
      sha256 "b4f10d9486f3ce98646d2857771dc9fe7a28eff6f366f2cad19ffb088b839a2d"
    end

    on_intel do
      url "https://github.com/dickwu/CloudConfig/releases/download/v0.1.1/cloudconfig-v0.1.1-x86_64-apple-darwin.tar.gz"
      sha256 "fc7e071aaf9ff3aafb08fcb629369bca2309b762b0958b0c0f9b430c09e8863d"
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
