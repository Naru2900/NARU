require "webrick"
require "net/http"
require "uri"

PORT = 8123
OLLAMA = URI("http://127.0.0.1:11434")

server = WEBrick::HTTPServer.new(
  Port: PORT,
  BindAddress: "127.0.0.1",
  DocumentRoot: Dir.pwd,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN)
)

server.mount_proc "/ollama" do |req, res|
  path = req.path.sub(%r{\A/ollama}, "")
  path = "/" if path.empty?

  uri = URI.join(OLLAMA.to_s, path.sub(%r{\A/}, ""))

  http = Net::HTTP.new(uri.host, uri.port)
  request_class =
    case req.request_method
    when "POST" then Net::HTTP::Post
    when "PUT" then Net::HTTP::Put
    else Net::HTTP::Get
    end

  proxy_req = request_class.new(uri.request_uri)

  req.header.each do |key, value|
    proxy_req[key] = value.join(", ")
  end

  proxy_req.body = req.body if req.body

  response = http.request(proxy_req)

  res.status = response.code.to_i
  response.each_header { |k, v| res[k] = v }
  res.body = response.body
end

trap("INT") { server.shutdown }

puts "NARU server running at http://127.0.0.1:#{PORT}"
puts "Ollama proxy: http://127.0.0.1:#{PORT}/ollama"
server.start
