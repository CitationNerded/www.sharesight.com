require 'ostruct'
load File::expand_path('../blog_helper.rb', __dir__)

module MiddlemanBlogHelpers

  def blog_posts(order: nil)
    @blog_posts ||= {}
    return @blog_posts[order] if @blog_posts[order]

    @blog_posts[order] ||= case order
      when :youngest_first
        data.blog.posts.values.sort do |a,b|
          a['created_at'] <=> b['created_at']
        end
      when :oldest_first
        data.blog.posts.values.sort do |a,b|
          b['created_at'] <=> a['created_at']
        end
      else
        data.blog.posts
      end
  end

  def post_url(post)
    return unlocalized_url("blog/#{BlogHelper::url_slug(post)}")
  end

  def blog_categories
    return @blog_categories if @blog_categories

    categories = []
    collection = data.blog.posts
      .map{ |tuple| tuple[1] }
      .select{ |model| BlogHelper.is_valid_post?(model) }

    categories_collection = data.blog.categories
      .map{ |tuple| tuple[1] }
      .select{ |model| BlogHelper.is_valid_category?(model) }

    collection = categories_collection.each do |category|
      set = collection.select { |model|
        # models that have the category id
        model[:categories]&.find{ |model_category| model_category[:id].include?(category[:id]) }
      }

      categories.push({
        id: category[:id],
        name: category[:name],
        description: category[:description],
        _meta: category[:_meta],
        path: "blog/#{url_friendly_string(category[:name])}",
        url_slug: url_friendly_string(category[:name]),
        count: set.length,
        set: set
      })
    end

    @blog_categories ||= categories.sort_by{ |x| x[:name] }
  end
end
