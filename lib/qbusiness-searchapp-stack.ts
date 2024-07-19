import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as q from "aws-cdk-lib/aws-qbusiness";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class QbusinessSearchappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appRole = new iam.Role(this, "AppRole", {
      assumedBy: new iam.ServicePrincipal("qbusiness.amazonaws.com")
    });

    appRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "cloudwatch:PutMetricData"
      ],
      resources: ["*"],
      conditions: {
        StringEquals: {
          "cloudwatch:namespace": "AWS/QBusiness"
        }
      }
    }));

    appRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "logs:DescribeLogGroups"
      ],
      resources: ["*"]
    }));

    appRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "logs:CreateLogGroup"
      ],
      resources: [
        `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/qbusiness/*`
      ]
    }));

    appRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "logs:DescribeLogStreams",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      resources: [
        `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/qbusiness/*:log-stream:*`
      ]
    }));

    const qApplication = new q.CfnApplication(this, "DevDocsApp", {
      displayName: `Dev-Docs-${this.stackName}`,
      roleArn: appRole.roleArn,
      identityCenterInstanceArn: process.env.IDC_INSTANCE_ARN
    });

    const documentsS3Bucket = new s3.Bucket(this, "QDocuments");

    const datasourceRole = new iam.Role(this, "DataSourceRole", {
      assumedBy: new iam.ServicePrincipal("qbusiness.amazonaws.com")
    });
    documentsS3Bucket.grantRead(datasourceRole);

    datasourceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "qbusiness:BatchPutDocument",
        "qbusiness:BatchDeleteDocument"
      ],
      resources: [
        `arn:${this.partition}:qbusiness:${this.region}:${this.account}:application/${qApplication.attrApplicationId}*`
      ]
    }));

    datasourceRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "qbusiness:PutGroup",
        "qbusiness:CreateUser",
        "qbusiness:DeleteGroup",
        "qbusiness:UpdateUser",
        "qbusiness:ListGroups"
      ],
      resources: [
        `arn:${this.partition}:qbusiness:${this.region}:${this.account}:application/${qApplication.attrApplicationId}*`
      ]
    }));

    const qIndex = new q.CfnIndex(this, "Index", {
      applicationId: qApplication.attrApplicationId,
      displayName: "Q-Index-For-Dev-Docs",
      type: "ENTERPRISE"
    });

    new q.CfnDataSource(this, "Datasource", {
      displayName: "Dev-Docs-Source",
      applicationId: qApplication.attrApplicationId,
      indexId: qIndex.attrIndexId,
      roleArn: datasourceRole.roleArn,
      description: "S3 datasource for the dev documents",
      configuration: {
        "type": "S3",
        "syncMode": "FULL_CRAWL",
        "connectionConfiguration": {
          "repositoryEndpointMetadata": {
            "BucketName": documentsS3Bucket.bucketName
          }
        },
        "repositoryConfigurations": {
          "document": {
            "fieldMappings": [
              {
                "dataSourceFieldName": "category",
                "indexFieldName": "_category",
                "indexFieldType": "STRING"
              }
            ]
          }
        }
      }
    })
  }
}
