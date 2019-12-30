import * as request from 'request';
import {JSDOM} from 'jsdom';
import {Article, FeedParser} from '@rss-proxy/core';
import {Feed} from 'feed';
import {FeedMappingOptions} from '../endpoints/feedEndpoint';
import {Item} from 'feed/src/typings/index';

export const feedService =  new class FeedService {
  mapToFeed(url: string, options: FeedMappingOptions): Promise<Feed> {
    return new Promise((resolve, reject) => {
      request(url, (error, serverResponse, body) => {
        if (!error && serverResponse && serverResponse.statusCode === 200) {

          const doc = new JSDOM(body).window.document;
          const feedParser = new FeedParser(doc);

          const feed = new Feed({
            title: doc.title,
            // description: doc.,
            id: url,
            link: url,
            // language: 'en', // optional, used only in RSS 2.0, possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
            favicon: "http://example.com/favicon.ico",
            copyright: "All rights reserved 2013, John Doe",
            updated: new Date(2013, 6, 14), // optional, default = today
            generator: "awesome", // optional, default = 'Feed for Node.js'
            feedLinks: {
              json: "https://example.com/json",
              atom: "https://example.com/atom"
            },
            author: {
              name: "John Doe",
              email: "johndoe@example.com",
              link: "https://example.com/johndoe"
            }
          });

          feedParser.getArticles().forEach((article: Article) => {

            const item: Item = {
              title: article.title,
              link: article.link,
              date: new Date(),
              description: article.summary.join(' / '),
              content: article.content
            };
            feed.addItem(item);
          });

          resolve(feed);
        } else {
          console.error(`proxy error ${url} cause ${error}, ${serverResponse.statusCode}`);
          reject(error);
        }
      });
    });
  }
}