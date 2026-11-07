# Per-map game info lives in _data/map_marks.yml together with the map's marks, so the
# Map marker tool (/tools/map-marker/) can edit everything about a map in one file.
# A map's entry there is either a plain list of marks (the old way) or:
#
#   M05:
#     terminal: no-vehicles
#     objectives: [...]
#     weapons: [...]            starting weapons
#     map_weapons: [...]        lying around on the map
#     secret_weapons: [...]     hidden ones
#     buildings: { players: gdi, gdi: [...], nod: [...], note: "..." }
#     marks: [...]
#
# Before the site is rendered this copies terminal / objectives / weapons / map_weapons /
# secret_weapons onto the map in site.data.maps, buildings into site.data.buildings.maps,
# and leaves site.data.map_marks as plain lists of marks, so the pages read them as before.
# The whole entries are kept in site.data.map_info for the Map marker.
module ExodusCommunity
  class MapInfoGenerator < Jekyll::Generator
    priority :high
    FIELDS = %w[terminal objectives weapons map_weapons secret_weapons].freeze

    def generate(site)
      raw = site.data["map_marks"]
      return unless raw.is_a?(Hash)
      marks = {}
      info = {}
      raw.each do |name, entry|
        if entry.is_a?(Array)
          marks[name] = entry
        elsif entry.is_a?(Hash)
          info[name] = entry
          marks[name] = entry["marks"] if entry["marks"].is_a?(Array) && !entry["marks"].empty?
        end
      end
      (site.data["maps"] || []).each do |map|
        entry = info[map["name"]]
        next unless entry
        FIELDS.each { |f| map[f] = entry[f] if entry.key?(f) }
      end
      buildings = (site.data["buildings"] ||= {})
      by_map = (buildings["maps"] ||= {})
      info.each { |name, entry| by_map[name] = entry["buildings"] if entry["buildings"].is_a?(Hash) }
      site.data["map_marks"] = marks
      site.data["map_info"] = info
    end
  end
end
