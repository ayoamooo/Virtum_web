const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./virtum.db', (err) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
  
  // Get all data
  db.all('SELECT * FROM biomarkers', (err, rows) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      return;
    }
    
    console.log(`📊 Total records: ${rows.length}\n`);
    
    rows.forEach((row, index) => {
      const data = JSON.parse(row.data);
      console.log(`Record ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Steps: ${data.steps}`);
      console.log(`  Heart Rate: ${data.heartRate} bpm`);
      console.log(`  Water: ${data.waterIntake} L`);
      console.log(`  Time: ${row.timestamp}`);
      console.log(`  Flagged: ${row.flagged}\n`);
    });
    
    db.close();
  });
});