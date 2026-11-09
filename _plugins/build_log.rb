# Says what Jekyll is doing during the part of a build it doesn't log: copying the files
# that aren't pages (pictures, sounds, scripts) into _site, which can take a while.
module ExodusCommunity
  module BuildLog
    @start = nil
    class << self; attr_accessor :start; end
  end
end

Jekyll::Hooks.register :site, :post_render do |site|
  files = site.static_files.select { |f| f.respond_to?(:modified?) ? f.modified? : true }
  mb = files.sum { |f| File.size?(f.path).to_i } / 1_000_000.0
  ExodusCommunity::BuildLog.start = Time.now
  if files.empty?
    Jekyll.logger.info "Copying:", "nothing new (#{site.static_files.size} files already in _site)"
  else
    Jekyll.logger.info "Copying:", "#{files.size} files that aren't pages (#{mb.round} MB: pictures, sounds, scripts)..."
  end
end

Jekyll::Hooks.register :site, :post_write do |_site|
  t = ExodusCommunity::BuildLog.start
  Jekyll.logger.info "Copying:", "done in #{(Time.now - t).round(1)} s" if t
end
