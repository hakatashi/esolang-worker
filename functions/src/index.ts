import type {DescribeTasksCommandInput, RunTaskCommandInput} from '@aws-sdk/client-ecs';
import {ECSClient, RunTaskCommand, waitUntilTasksStopped} from '@aws-sdk/client-ecs';
import {S3Client, PutObjectCommand, GetObjectCommand} from '@aws-sdk/client-s3';
import type {PutObjectCommandInput, GetObjectCommandInput} from '@aws-sdk/client-s3'; // ES Modules import
import type {WaiterConfiguration} from '@smithy/util-waiter';
import {config as getConfig} from 'firebase-functions';
import * as logger from 'firebase-functions/logger';
import {onRequest} from 'firebase-functions/v2/https';
import uniqid from 'uniqid';

const config = getConfig();

const ecs = new ECSClient({
	region: 'ap-northeast-1',
	credentials: {
		accessKeyId: config.aws.access_key,
		secretAccessKey: config.aws.secret_access_key,
	},
});

const s3 = new S3Client({
	region: 'ap-northeast-1',
	credentials: {
		accessKeyId: config.aws.access_key,
		secretAccessKey: config.aws.secret_access_key,
	},
});

export const helloWorld = onRequest({timeoutSeconds: 300}, async (request, response) => {
	const code = [
		'console.log("hello");',
		'console.error("world");',
	].join('\n');

	const executionId = uniqid();
	logger.info(`Execution ID: ${executionId}`);

	{
		const putObjectParams: PutObjectCommandInput = {
			Bucket: 'esolang-worker',
			Key: `${executionId}/code`,
			Body: Buffer.from(code, 'utf-8'),
		};
		const putObjectResult = await s3.send(new PutObjectCommand(putObjectParams));
		logger.info(putObjectResult);
	}

	{
		const putObjectParams: PutObjectCommandInput = {
			Bucket: 'esolang-worker',
			Key: `${executionId}/stdin`,
			Body: Buffer.from('hoge', 'utf-8'),
		};
		const putObjectResult = await s3.send(new PutObjectCommand(putObjectParams));
		logger.info(putObjectResult);
	}

	{
		const runTaskParams: RunTaskCommandInput = {
			cluster: 'esolang-worker',
			taskDefinition: 'esolang-worker-node',
			count: 1,
			capacityProviderStrategy: [
				{
					capacityProvider: 'FARGATE',
					base: 0,
					weight: 1,
				},
			],
			networkConfiguration: {
				awsvpcConfiguration: {
					subnets: ['subnet-0eca90bd815af7171'],
					assignPublicIp: 'DISABLED',
					securityGroups: ['sg-0f48b176008f277aa'],
				},
			},
			overrides: {
				containerOverrides: [
					{
						name: 'esolang-worker-node',
						environment: [
							{
								name: 'ESOLANG_WORKER_EXECUTION_ID',
								value: executionId,
							},
						],
					},
				],
			},
		};

		const runTaskResult = await ecs.send(new RunTaskCommand(runTaskParams));

		logger.info(runTaskResult);

		if (!runTaskResult.tasks || runTaskResult.tasks.length === 0) {
			throw new Error('Task not found');
		}

		const task = runTaskResult.tasks[0].taskArn;

		if (!task) {
			throw new Error('Task not found');
		}

		const waiterParams: WaiterConfiguration<ECSClient> = {
			client: ecs,
			maxWaitTime: 300,
			minDelay: 1,
			maxDelay: 1,
		};

		const waitUntilTasksStoppedParams: DescribeTasksCommandInput = {
			cluster: 'esolang-worker',
			tasks: [task],
		};

		await waitUntilTasksStopped(waiterParams, waitUntilTasksStoppedParams);

		logger.info('Task has stopped');
	}

	{
		const getObjectParams: GetObjectCommandInput = {
			Bucket: 'esolang-worker',
			Key: `${executionId}/stdout`,
		};
		const getObjectResult = await s3.send(new GetObjectCommand(getObjectParams));
		const body = await getObjectResult.Body?.transformToByteArray();
		if (!body) {
			throw new Error('Body not found');
		}
		const bodyBuffer = Buffer.from(body);
		logger.info(bodyBuffer.toString('utf-8'));
	}

	{
		const getObjectParams: GetObjectCommandInput = {
			Bucket: 'esolang-worker',
			Key: `${executionId}/stderr`,
		};
		const getObjectResult = await s3.send(new GetObjectCommand(getObjectParams));
		const body = await getObjectResult.Body?.transformToByteArray();
		if (!body) {
			throw new Error('Body not found');
		}
		const bodyBuffer = Buffer.from(body);
		logger.info(bodyBuffer.toString('utf-8'));
	}

	response.send('ok');
});
