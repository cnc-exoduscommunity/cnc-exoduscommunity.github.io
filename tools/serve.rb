# Runs `jekyll serve` and restarts it whenever _config.yml changes, because
# Jekyll only reads _config.yml when it starts. Every other change (pages,
# layouts, includes, _data, CSS, images) is picked up by Jekyll itself, which
# rebuilds the whole site; .jekyll-cache keeps that fast.
#
# Started by tools/serve.bat and tools/serve.sh from the site root:
#   ruby tools/serve.rb <host> <port>

host = ARGV[0] || "127.0.0.1"
port = ARGV[1] || "4000"
config = "_config.yml"
windows = Gem.win_platform?

$stdout.sync = true

# Run bundler through this same Ruby, so there is one process to stop
# (`bundle exec` loads jekyll in-process instead of starting another one).
bundle = Gem.bin_path("bundler", "bundle")
command = [Gem.ruby, bundle, "exec", "jekyll", "serve",
           "--host", host, "--port", port, "--livereload"]

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
