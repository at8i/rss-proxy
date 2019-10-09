module.exports = function (document, console) {

  this.getDocumentRoot = () => {
    return document.getElementsByTagName('body').item(0);
  };

  this.getRelativePath = (node, context, withClassNames) => {
    let path = node.tagName; // tagName for text nodes is undefined
    while (node.parentNode !== context) {
      node = node.parentNode;
      if (typeof (path) === 'undefined') {
        path = this.getTagName(node, withClassNames);
      } else {
        path = `${this.getTagName(node, withClassNames)}>${path}`;
      }
    }
    return path;
  };

  this.findLinks = () => {
    return Array.from(document.getElementsByTagName('A'));
  };

  this.findArticleContext = (nodeElements, root) => {
    let currentNodes = nodeElements.map(nodeElement => nodeElement.element);
    while (true) {
      let parentNodes = currentNodes.map(currentNode => currentNode.parentNode);
      // todo all parent nodes are the same
      if (parentNodes[0].isSameNode(parentNodes[1])) {
        break;
      }
      currentNodes = parentNodes;
    }

    return nodeElements.map((nodeElement, index) => {
      const link = nodeElement.element;
      const context = currentNodes[index];
      return {
        linkElement: link,
        contextElement: context,
        contextElementPath: this.getRelativePath(context, root)
      }
    })
  };

  this.toWords = (text) => {
    return text.trim().split(' ').filter(word => word.length > 0);
  };

  this.textNodesUnder = (el) => {
    const textNodes = [];
    const walk = document.createTreeWalker(el, -1, null, false);
    let node;
    while ((node = walk.nextNode())) {
      if (node.cloneNode(false).textContent.trim().length > 0) {
        textNodes.push(node);
      }
    }
    return textNodes;
  };

  this.findCommonTextNodes = function (articles) {
    const referenceArticleNode = articles[0].contextElement;
    const textNodes = this.textNodesUnder(referenceArticleNode);

    const groupedTextNodes = textNodes
      .map(textNode => this.getRelativePath(textNode, referenceArticleNode))
      .reduce((map, pathToTextNode) => {
        // check every article contains the path
        const existsEverywhere = articles.every(article => {
          const resolvedTextNode = article.contextElement.querySelector(pathToTextNode);
          // article.commonTextNodes.push(resolvedTextNode);
          return !pathToTextNode || resolvedTextNode !== null;
        });

        if (existsEverywhere) {
          map.common.push(pathToTextNode);
        } else {
          map.notCommon.push(pathToTextNode);
        }
        return map;

      }, {common: [], notCommon: []});

    return {
      articles,
      commonTextNodePath: this.uniq(groupedTextNodes.common),
      notcommonTextNodePath: this.uniq(groupedTextNodes.notCommon).filter(notCommonPath => !groupedTextNodes.common.some(commonPath => notCommonPath.startsWith(commonPath))),
      structureSimilarity: groupedTextNodes.common.length / textNodes.length
    };
  };

  this.getTagName = (node, withClassNames) => {
    if (!withClassNames) {
      return node.tagName;
    }
    const classList = Array.from(node.classList)
      .filter(cn => cn.match('[0-9]+') === null);
    if (classList.length > 0) {
      return `${node.tagName}.${classList.join('.')}`;
    }
    return node.tagName;
  };

  this.uniq = (list) => {
    return list.reduce((uniqList, item) => {

      if (uniqList.indexOf(item) === -1) {
        uniqList.push(item);
      }

      return uniqList;
    }, [])
  };

  this.findTitle = (group) => {
    const referenceArticle = group.articles[0];
    const sortedTitleNodes = group.commonTextNodePath.map((textNodePath) => {
      const wordsOfNode = group.articles
        .map(article => {
          const otherTextNode = article.contextElement.querySelector(textNodePath);
          return this.toWords(otherTextNode.textContent);
        });
      const words = wordsOfNode.flat(1);
      const variance = this.uniq(words).length / words.length;

      const totalWordCountSum = wordsOfNode.map(words => words.length).reduce((sum, wordCount) => sum + wordCount, 0);
      const avgWordCount = totalWordCountSum / wordsOfNode.length;

      return {variance, avgWordCount, textNodePath};
    })
      .filter((d) => {
        return d.avgWordCount > 3;
      })
      .sort((a, b) => {
        return b.variance - a.variance;
      });

    if (sortedTitleNodes.length === 0) {
      throw new Error('No textNode found that looks like a title');
    }

    const titlePath = sortedTitleNodes[0];
    return {
      stats: {title: titlePath},
      articles: group.articles,
      structureSimilarity: group.structureSimilarity,
      path: referenceArticle.contextElementPath,
      link: this.getRelativePath(referenceArticle.linkElement, referenceArticle.contextElement),
      title: titlePath,
      commonTextNodePath: group.commonTextNodePath.filter(path => path !== titlePath),
      notcommonTextNodePath: group.notcommonTextNodePath
    }
  };

  this.findDescription = (group) => {
    // avg word count
    const articleWords = group.articles.map(article => {
      return group.commonTextNodePath
        .map(path => Array.from(article.contextElement.querySelectorAll(path))
          .map(textNode => textNode.textContent)
        )
        .flat(1)
        .map(text => this.toWords(text))
        .flat(1);
    });

    const totalWordCount = articleWords.reduce((sum, articleWords) => {
      return sum + articleWords.length;
    }, 0);
    group.stats.description = {
      variance: this.uniq(articleWords.flat(1)).length / articleWords.flat(1).length,
      avgWordCount: totalWordCount / group.articles.length
    };
    return group;
  };

  this.getArticleRules = () => {
    const body = this.getDocumentRoot();
    const linkElements = this.findLinks()
      .filter(element => this.toWords(element.textContent).length > 3)
      .map(element => {
        return {element, path: this.getRelativePath(element, body)};
      });
    const linksGroupedByPath = linkElements.reduce((groups, linkPath) => {
      if (!groups[linkPath.path]) {
        groups[linkPath.path] = [];
      }
      groups[linkPath.path].push(linkPath);
      return groups;
    }, {});

    const relevantGroups = Object.values(linksGroupedByPath)
      .filter(group => group.length > 3)
      .map(linkElements => this.findArticleContext(linkElements, body))
      // find shared text nodes
      .map(articlesInGroup => this.findCommonTextNodes(articlesInGroup))
      // find title: title is the first text node that has in avg 3+ words and is wrapped by the link
      .map(articlesInGroup => this.findTitle(articlesInGroup))
      // find description
      .map(articlesInGroup => this.findDescription(articlesInGroup));

    return relevantGroups
      .map(group => {

        group.score = group.stats.title.variance * group.stats.title.avgWordCount +
          group.stats.description.variance * group.stats.description.avgWordCount;

        return group;
      })
      .sort((a, b) => b.score - a.score);
  };

  this.getArticles = () => {

    const bestRule = this.getArticleRules()[0];
    return Array.from(document.querySelectorAll(bestRule.path)).map(element => {
      return {
        title: element.querySelector(bestRule.title.textNodePath).textContent.trim(),
        link: element.querySelector(bestRule.link).getAttribute('href'),
        description: bestRule.commonTextNodePath.map(textNodePath => {
          return Array.from(element.querySelectorAll(textNodePath)).map(textNode => textNode.textContent.trim());
        })
          .flat(1)
          .filter(text => text.length > 2)
      }
    })

  };

  return this;
};
