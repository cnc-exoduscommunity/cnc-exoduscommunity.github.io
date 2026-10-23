# Adds the last git commit's details to the site, for the "Site revision"
# line in the footer (_layouts/default.html), like the Gears 5 Database:
#   site.last_commit.hash / full_hash / time / branch
#   site.host_os  ("Windows", "Mac" or "Unix" - the system that built the site)
#
# Works the same locally and in GitHub Actions (the deploy workflow checks out
# the repo with git history, which is all `git log -1` needs). If git is not
# available, or there is no .git folder, the values are simply left out and
# the footer falls back to the build time - the build never fails because of it.
require "open3"

module ExodusCommunity
  class LastCommitGenerator < Jekyll::Generator
    priority :highest

    def generate(site)
      dir = site.source
      commit = {}

      if (info = git(dir, "log", "-1", "--format=%H%n%h%n%cI"))
        full_hash, hash, time = info.split("\n", 3)
        commit["full_hash"] = full_hash
        commit["hash"] = hash
        commit["time"] = time
      end

      # Actions checks out a single commit (detached HEAD), so the real branch
      # name comes from GITHUB_REF_NAME there; locally it comes from git.
      branch = ENV["GITHUB_REF_NAME"] || git(dir, "rev-parse", "--abbrev-ref", "HEAD")
      commit["branch"] = branch if branch && branch != "HEAD"

      site.config["last_commit"] = commit
      site.config["host_os"] = host_os
    end

    private

    def host_os
      os = RbConfig::CONFIG["host_os"].to_s.downcase
      if os.match?(/mingw|mswin|cygwin/) then "Windows"
      elsif os.match?(/darwin|mac os/) then "Mac"
      else "Unix"
      end
    end

    # Runs one git command in the site folder; nil if it fails for any reason.
    def git(dir, *args)
      out, status = Open3.capture2e("git", "-C", dir, *args)
      status.success? ? out.strip : nil
    rescue StandardError
      nil
    end
  end
end
