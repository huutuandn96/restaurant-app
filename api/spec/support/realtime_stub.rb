# Không publish lên Redis thật khi chạy test; ghi lại để assert
module RealtimeSpy
  def self.events = (@events ||= [])
  def self.reset! = (@events = [])
end

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
  config.before do
    RealtimeSpy.reset!
    allow(Realtime).to receive(:publish) { |**kw| RealtimeSpy.events << kw }
  end
end
