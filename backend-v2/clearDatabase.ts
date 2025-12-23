import { DatabaseUtils } from './packages/shared-aws-utils/src/dynamodb';

async function clearDatabase() {
    await DatabaseUtils.clearAllData();
}

clearDatabase()
    .then(() => {
        console.log('Database cleared successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error clearing database:', error);
        process.exit(1);
    });
