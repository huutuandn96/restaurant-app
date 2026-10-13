namespace :tables do
  desc "In URL QR của các bàn (make qr)"
  task urls: :environment do
    Table.ordered.each do |t|
      puts format("  %-8s %-14s %s", t.label, t.area, t.qr_url)
    end
  end
end
