source "https://rubygems.org"

# Plain Jekyll 4. The site is built by GitHub Actions (.github/workflows/deploy.yml),
# so it is not limited to the plugins of the github-pages gem.
gem "jekyll", "~> 4.4"

group :jekyll_plugins do
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-sitemap", "~> 1.4"
end

# Windows has no zoneinfo files, and needs wdm so `jekyll serve` can watch for changes.
platforms :windows, :jruby do
  gem "tzinfo", ">= 1.2", "< 3"
  gem "tzinfo-data"
end
gem "wdm", "~> 0.2.0", platforms: [:windows]

# Ruby 3+ no longer ships webrick, which `jekyll serve` needs.
gem "webrick", "~> 1.8"
