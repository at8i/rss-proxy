import {Express, Request, Response} from 'express';
import cors from 'cors';
import logger from '../logger';
import {FeedParserError, feedService, GetResponse} from '../services/feedService';
import {FeedParserResult, OutputType} from '@rss-proxy/core';
import {analyticsService} from '../services/analyticsService';
import httpUtil from '../httpUtil';

export const feedEndpoint = new class FeedEndpoint {
  register(app: Express) {

    /**
     * Used by the playground
     * @return json of the verbose feedparser data, or an error
     */
    app.get('/api/feed/playground', cors(), (request: Request, response: Response) => {
      try {
        const url = request.query.url as string;
        logger.info(`live feed-mapping of ${url}`);

        analyticsService.track('playground-feed', request, {url});

        feedService.parseFeed(url, request)
          .then((feedParserResult: FeedParserResult) => {
            response.json(feedParserResult);

          })
          .catch((err: FeedParserError) => {
            logger.error(`Failed to proxy ${url}, cause ${err.message}`);
            response.json(err);
          });

      } catch (e) {
        response.json({message: e.message} as FeedParserError);
      }
    });

    /**
     *
     * @param url, mandatory string
     * @param preferNativeFeed, opt-out boolean to prefer the single exposed feed
     */
    app.get('/api/feed', cors(), (request: Request, response: Response) => {
      try {
        const url = request.query.url as string;
        const preferNativeFeed = request.query.preferNativeFeed !== 'false';
        logger.info(`feed for '${url}', nativeFeed=${preferNativeFeed}`);
        analyticsService.track('feed', request, {url});

        feedService.parseFeed(url, request, preferNativeFeed)
          .then((feedData: FeedParserResult | GetResponse) => {
            if ((feedData as any)['type'] === 'GetResponse') {
              const getResponse = feedData as GetResponse;
              response.setHeader('Content-Type', getResponse.contentType);
              response.send(getResponse.body);
            } else {
              const feedParserResult = feedData as FeedParserResult;
              response.setHeader('Content-Type', this.outputToContentType(feedParserResult.feedOutputType));
              response.send(feedParserResult.feed);
            }

          })
          .catch((err: FeedParserError) => {
            // todo mag always return a valid feed, not a json error
            logger.error(`Failed to proxy ${url}, cause ${err.message}`);
            response.json(err);
          });

      } catch (e) {
        response.json({message: e.message});
      }
    });

  }

  private outputToContentType(outputType: OutputType): string {
    switch (outputType) {
      case OutputType.ATOM: return 'application/atom+xml';
      case OutputType.RSS: return 'application/rss+xml';
      case OutputType.JSON:
      default:
        return 'application/json';
    }
  }
};
