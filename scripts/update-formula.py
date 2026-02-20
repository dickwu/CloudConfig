#!/usr/bin/env python3
"""Regenerate Formula/cloudconfig.rb with updated URLs and SHA256 hashes.

Called by CI during release:
    python3 scripts/update-formula.py <version-tag> <arm-sha256> <x86-sha256>

Example:
    python3 scripts/update-formula.py v1.2.3 abc123... def456...
"""

import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <version-tag> <arm-sha256> <x86-sha256>", file=sys.stderr)
        sys.exit(1)

    version_tag = sys.argv[1]          # e.g. v1.2.3
    arm_sha = sys.argv[2]
    x86_sha = sys.argv[3]

    version = version_tag.lstrip("v")  # e.g. 1.2.3
    base = f"https://github.com/dickwu/CloudConfig/releases/download/{version_tag}"

    formula = f"""\
# typed: false
# frozen_string_literal: true

# This file is auto-updated by CI on each release. Do not edit manually.
class Cloudconfig < Formula
  desc "Secure cloud configuration sync server"
  homepage "https://github.com/dickwu/CloudConfig"
  version "{version}"
  license "MIT"

  on_macos do
    on_arm do
      url "{base}/cloudconfig-{version_tag}-aarch64-apple-darwin.tar.gz"
      sha256 "{arm_sha}"
    end

    on_intel do
      url "{base}/cloudconfig-{version_tag}-x86_64-apple-darwin.tar.gz"
      sha256 "{x86_sha}"
    end
  end

  def install
    bin.install "cloudconfig"
  end

  service do
    run [opt_bin/"cloudconfig"]
    keep_alive true
    working_dir "#{{etc}}/cloudconfig"
    log_path var/"log/cloudconfig.log"
    error_log_path var/"log/cloudconfig.log"
  end

  test do
    assert_predicate bin/"cloudconfig", :exist?
  end
end
"""

    out = Path(__file__).parent.parent / "Formula" / "cloudconfig.rb"
    out.write_text(formula)
    print(f"Updated {out} to {version_tag}")


if __name__ == "__main__":
    main()
