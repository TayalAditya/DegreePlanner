# Run this script to set up your Degree Planner application

Write-Host "🎓 Degree Planner - Setup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit .env file with your credentials:" -ForegroundColor Yellow
    Write-Host "   1. DATABASE_URL - Your PostgreSQL connection string" -ForegroundColor White
    Write-Host "   2. NEXTAUTH_SECRET - Generate with: openssl rand -base64 32" -ForegroundColor White
    Write-Host "   3. GOOGLE_CLIENT_ID - From Google Cloud Console" -ForegroundColor White
    Write-Host "   4. GOOGLE_CLIENT_SECRET - From Google Cloud Console" -ForegroundColor White
    Write-Host ""
    
    # Wait for user to configure
    $continue = Read-Host "Have you configured the .env file? (y/n)"
    if ($continue -ne "y") {
        Write-Host "❌ Please configure .env file and run this script again" -ForegroundColor Red
        exit
    }
}

Write-Host "Step 1: Generating Prisma Client..." -ForegroundColor Cyan
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Pushing database schema..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push database schema" -ForegroundColor Red
    Write-Host "   Make sure PostgreSQL is running and DATABASE_URL is correct" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Database schema created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Seeding database with sample data..." -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Failed to seed database (this is optional)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Sample data added" -ForegroundColor Green
}
Write-Host ""

Write-Host "Step 4: Adding approved users..." -ForegroundColor Cyan
npm run add-users
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Failed to add users (this is optional)" -ForegroundColor Yellow
} else {
    Write-Host "✅ Approved users added" -ForegroundColor Green
}
Write-Host ""

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✨ Setup Complete! ✨" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start the development server: npm run dev" -ForegroundColor White
Write-Host "2. Visit: http://localhost:3000" -ForegroundColor White
Write-Host "3. Sign in with an approved Google account" -ForegroundColor White
Write-Host ""
Write-Host "Optional:" -ForegroundColor Cyan
Write-Host "- View database: npm run db:studio" -ForegroundColor White
Write-Host "- Add more users: Edit scripts/add-users.ts and run: npm run add-users" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "- Quick start: QUICKSTART.md" -ForegroundColor White
Write-Host "- Features: FEATURES.md" -ForegroundColor White
Write-Host "- Setup guide: SETUP.md" -ForegroundColor White
Write-Host ""
