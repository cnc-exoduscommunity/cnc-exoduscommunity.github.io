# Runs `jekyll serve` and restarts it whenever _config.yml changes, because
# Jekyll only reads _config.yml when it starts. Every other change (pages,
# layouts, includes, _data, CSS, images) is picked up by Jekyll itself, which
# rebuilds the whole site; .jekyll-cache keeps that fast.
#
# Started by tools/serve.bat and tools/serve.sh from the site root:
#   ruby tools/serve.rb <host> <port> [extra jekyll options, e.g. --verbose --trace]

host = ARGV[0] || "127.0.0.1"
port = ARGV[1] || "4000"
extra = ARGV[2..] || []   # e.g. --verbose --trace (serve verbose)
config = "_config.yml"
windows = Gem.win_platform?

$stdout.sync = true

# Run bundler through this same Ruby, so there is one process to stop
# (`bundle exec` loads jekyll in-process instead of starting another one).
bundle = Gem.bin_path("bundler", "bundle")
# _config_dev.yml: local-only settings (the sounds are linked, not copied; see below).
configs = File.exist?("_config_dev.yml") ? "_config.yml,_config_dev.yml" : "_config.yml"
command = [Gem.ruby, bundle, "exec", "jekyll", "serve", "--config", configs,
           "--host", host, "--port", port, "--livereload", *extra]

# Link _site/assets/sounds to assets/sounds instead of copying 10,000+ files on every
# start: a junction on Windows (no admin rights needed), a symlink elsewhere.
def link_sounds(windows)
  src = File.expand_path("assets/sounds")
  dest = File.expand_path("_site/assets/sounds")
  return unless File.directory?(src) && File.exist?("_config_dev.yml")
  # Already a link: leave it (never delete through it, that would delete the real sounds).
  return if File.symlink?(dest) || (windows && File.directory?(dest) && junction?(dest))
  require "fileutils"
  FileUtils.mkdir_p(File.dirname(dest))
  if File.directory?(dest)                            # an old full copy from before
    puts "Removing the old copy of the sounds in _site (once)..."
    FileUtils.rm_rf(dest)
  end
  if windows
    system("cmd", "/c", "mklink", "/J", dest.tr("/", "\\"), src.tr("/", "\\"), out: File::NULL)
  else
    File.symlink(src, dest)
  end
  puts(File.exist?(File.join(dest, "index.json")) ? "Linked _site/assets/sounds to assets/sounds (not copied)." : "Couldn't link the sounds; Jekyll won't have them.")
end

def junction?(path)
  `cmd /c dir /AL "#{File.dirname(path).tr("/", "\\")}" 2>nul`.include?(File.basename(path))
end

def mtime(path)
  File.mtime(path)
rescue Errno::ENOENT
  nil
end

def stop(pid, windows)
  return unless pid
  begin
    # Windows has no INT signal for other processes; KILL ends it at once.
    Process.kill(windows ? "KILL" : "INT", pid)
    Process.wait(pid)
  rescue Errno::ESRCH, Errno::ECHILD
  end
end

pid = nil
trap("INT") do
  stop(pid, windows)
  exit 0
end

loop do
  started = mtime(config)
  link_sounds(windows)
  pid = spawn(*command)

  # Wait until Jekyll stops on its own, or _config.yml changes.
  loop do
    sleep 1
    if Process.wait(pid, Process::WNOHANG)
      puts
      puts "Jekyll stopped (exit code #{$?.exitstatus})."
      exit($?.exitstatus || 1)
    end
    break if mtime(config) != started
  end

  puts
  puts "#{config} changed - restarting Jekyll so the new settings are used..."
  puts
  stop(pid, windows)
end
