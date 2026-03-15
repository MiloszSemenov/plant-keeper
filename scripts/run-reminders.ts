import { sendDailyWateringReminders } from "../services/reminders";

async function main() {
  const summary = await sendDailyWateringReminders();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
