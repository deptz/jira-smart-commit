import * as vscode from 'vscode';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { UsageMetadata } from './types';
import { getAIConfigWithTeamDefaults } from './aiConfigManager';

/**
 * Hash email using SHA-256 for anonymization
 */
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email).digest('hex');
}

/**
 * Resolve tracking URL - supports both absolute URLs and relative paths
 */
function resolveTrackingUrl(trackingUrl: string, baseUrl?: string): string | null {
  try {
    // Check if it's an absolute URL
    if (trackingUrl.startsWith('http://') || trackingUrl.startsWith('https://')) {
      new URL(trackingUrl); // Validate URL format
      return trackingUrl;
    }

    // It's a relative path - require baseUrl
    if (!baseUrl) {
      return null;
    }

    // Remove trailing slash from baseUrl and leading slash from trackingUrl
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const cleanPath = trackingUrl.startsWith('/') ? trackingUrl : `/${trackingUrl}`;
    
    const fullUrl = `${cleanBaseUrl}${cleanPath}`;
    new URL(fullUrl); // Validate URL format
    return fullUrl;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Check if tracking is enabled and properly configured
 */
function isTrackingEnabled(context: vscode.ExtensionContext, aiProvider?: string, baseUrl?: string, trackingUrl?: string): boolean {
  // Tracking requires team gateway to be enabled
  if (aiProvider !== 'team-gateway') {
    return false;
  }

  // Validate tracking URL can be resolved
  if (!trackingUrl) {
    return false;
  }

  const resolvedUrl = resolveTrackingUrl(trackingUrl, baseUrl);
  if (!resolvedUrl) {
    return false;
  }

  return true;
}

/**
 * Get tracking API key if authentication is required
 */
async function getTrackingApiKey(context: vscode.ExtensionContext, requiresAuth: boolean): Promise<string | undefined> {
  if (!requiresAuth) {
    return undefined;
  }

  // Use the same API key as team gateway for tracking
  const secretKey = 'jiraSmartCommit.ai.apiKey';
  const existing = await context.secrets.get(secretKey);
  return existing;
}

/**
 * Send usage tracking data to team gateway analytics endpoint
 * Fire-and-forget with 5-second timeout, fails silently
 */
export async function sendTrackingData(
  context: vscode.ExtensionContext,
  metadata: UsageMetadata,
  config: {
    enableUsageTracking: boolean;
    trackingUrl: string;
    trackingRequiresAuth: boolean;
    anonymizeUser: boolean;
  }
): Promise<void> {
  try {
    // Check if tracking is disabled in config
    if (!config.enableUsageTracking) {
      return;
    }

    // Get AI configuration to check provider and baseUrl
    const aiConfig = getAIConfigWithTeamDefaults();
    
    // Silently fail if team gateway is not enabled or URL is invalid
    if (!isTrackingEnabled(context, aiConfig.provider, aiConfig.baseUrl, config.trackingUrl)) {
      return;
    }

    // Resolve tracking URL
    const resolvedUrl = resolveTrackingUrl(config.trackingUrl, aiConfig.baseUrl);
    if (!resolvedUrl) {
      return;
    }

    // Anonymize user email if configured
    const trackingMetadata = { ...metadata };
    if (config.anonymizeUser && metadata.user) {
      trackingMetadata.user = hashEmail(metadata.user);
    }

    // Get API key if authentication is required
    const apiKey = await getTrackingApiKey(context, config.trackingRequiresAuth);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-feature-type': trackingMetadata.feature,
      'x-metadata-version': trackingMetadata.metadataVersion,
      'x-user-email': trackingMetadata.user,
      'x-request-id': trackingMetadata.requestId,
      'x-timestamp': trackingMetadata.timestamp,
    };

    // Add optional headers if present
    if (trackingMetadata.jiraKey) {
      headers['x-jira-key'] = trackingMetadata.jiraKey;
    }
    if (trackingMetadata.repository) {
      headers['x-repository'] = trackingMetadata.repository;
    }
    if (trackingMetadata.branch) {
      headers['x-branch'] = trackingMetadata.branch;
    }

    // Add authorization if required
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Send fire-and-forget request with 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(resolvedUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(trackingMetadata),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
  } catch (error) {
    // Fail silently - tracking should never disrupt the main flow
    // No logging or error reporting
  }
}
