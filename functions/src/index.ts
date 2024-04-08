import type {DescribeLogStreamsCommandInput, GetLogEventsCommandInput} from '@aws-sdk/client-cloudwatch-logs';
import {CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand} from '@aws-sdk/client-cloudwatch-logs';
import type {RunTaskCommandInput} from '@aws-sdk/client-ecs';
import {ECSClient, RunTaskCommand} from '@aws-sdk/client-ecs';
import {config as getConfig} from 'firebase-functions';
import * as logger from 'firebase-functions/logger';
import {onRequest} from 'firebase-functions/v2/https';

const config = getConfig();

export const helloWorld = onRequest(async (request, response) => {
	logger.info('Hello logs!', {structuredData: true});

	const ecs = new ECSClient({
		region: 'ap-northeast-1',
		credentials: {
			accessKeyId: config.aws.access_key,
			secretAccessKey: config.aws.secret_access_key,
		},
	});

	const runTaskParams: RunTaskCommandInput = {
		cluster: 'esolang-test',
		taskDefinition: 'esolang-worker-node',
		count: 1,
		capacityProviderStrategy: [
			{
				capacityProvider: 'FARGATE_SPOT',
				base: 0,
				weight: 1,
			},
		],
		networkConfiguration: {
			awsvpcConfiguration: {
				subnets: ['subnet-e686fdce'],
				assignPublicIp: 'DISABLED',
				securityGroups: ['sg-3b66cb5f'],
			},
		},
	};

	const runTaskResult = await ecs.send(new RunTaskCommand(runTaskParams));

	logger.info(runTaskResult);

	const cloudwatch = new CloudWatchLogsClient({
		region: 'ap-northeast-1',
		credentials: {
			accessKeyId: config.aws.access_key,
			secretAccessKey: config.aws.secret_access_key,
		},
	});

	const describeLogStreamsParams: DescribeLogStreamsCommandInput = {
		logGroupName: '/ecs/esolang-test',
	};

	const describeLogStreamsResult = await cloudwatch.send(new DescribeLogStreamsCommand(describeLogStreamsParams));

	logger.info(describeLogStreamsResult);

	const getLogEventsParams: GetLogEventsCommandInput = {
		logGroupName: '/ecs/esolang-test',
		logStreamName: describeLogStreamsResult.logStreams![1].logStreamName!,
	};

	const getLogEventsResult = await cloudwatch.send(new GetLogEventsCommand(getLogEventsParams));

	logger.info(getLogEventsResult);

	response.json(getLogEventsResult);
});
